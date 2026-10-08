import { collection, doc, getDocsFromServer, runTransaction, writeBatch, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { timerInput, eventInput, namedInput, labelName, assertEventDate, assertTimerDate } from './validation';
import { toCSV } from './export';
import type { Snapshot, Timer, Event } from './timers';

function uid() { const id=auth.currentUser?.uid; if(!id)throw new Error('Please sign in to access your timers.'); return id; }
function records(name:string,account=uid()){return collection(firestore,'users',account,name);}
function ref(name:string,id:string,account=uid()){if(!id||id.includes('/'))throw new Error('Invalid record identifier.');return doc(records(name,account),id);}
async function rows<T>(name:string,account=uid()):Promise<T[]>{const result=await getDocsFromServer(records(name,account));return result.docs.map(d=>({...d.data(),id:d.id}) as T);}
async function ensurePersonal(account:string){const r=ref('workspaces','personal',account);await runTransaction(firestore,async tx=>{if(!(await tx.get(r)).exists())tx.set(r,{name:'Personal'});});}
async function write(r:DocumentReference,data:DocumentData){await runTransaction(firestore,async tx=>{tx.set(r,data);});}
async function remove(items:DocumentReference[]){for(let i=0;i<items.length;i+=400){const batch=writeBatch(firestore);items.slice(i,i+400).forEach(r=>batch.delete(r));await batch.commit();}}

export async function snapshot():Promise<Snapshot>{
 const user=auth.currentUser;if(!user)throw new Error('Please sign in.');const account=user.uid;
 let workspaces=await rows<Snapshot['workspaces'][number]>('workspaces',account);if(!workspaces.length){await ensurePersonal(account);workspaces=await rows('workspaces');}
 const [folders,timers,labels,events]=await Promise.all([rows<Snapshot['folders'][number]>('folders',account),rows<Timer>('timers',account),rows<Snapshot['labels'][number]>('labels',account),rows<Event>('events',account)]);
 if(auth.currentUser?.uid!==account)throw new Error('Account changed. Please try again.');
 const valid=new Set(workspaces.map(w=>w.id));const stats=new Map<string,{count:number;lastEvent:string|null}>();
 for(const e of events){const v=stats.get(e.timerId)??{count:0,lastEvent:null};v.count++;if(!v.lastEvent||v.lastEvent<e.happenedAt)v.lastEvent=e.happenedAt;stats.set(e.timerId,v);}
 return {workspaces:workspaces.sort((a,b)=>a.id==='personal'?-1:b.id==='personal'?1:a.name.localeCompare(b.name)),folders:folders.filter(f=>valid.has(f.workspaceId)),labels:labels.filter(l=>valid.has(l.workspaceId)),timers:timers.filter(t=>valid.has(t.workspaceId)).map(t=>({...t,...stats.get(t.id)??{count:0,lastEvent:null}})),user:{name:user.displayName??user.email??'Your account',email:user.email??''}};
}

export async function mutate(payload:Record<string,unknown>){
 const account=uid(),action=payload.action;
 const localRef=(name:string,id:string)=>ref(name,id,account),localRows=<T>(name:string)=>rows<T>(name,account);
 async function localWorkspace(id:string){const r=localRef('workspaces',id);if(!(await runTransaction(firestore,async tx=>(await tx.get(r)).exists())))throw new Error('Workspace not found.');}
 if(action==='save-workspace'||action==='save-folder'||action==='save-label'){
  const p=namedInput.parse(payload);const kind=action==='save-workspace'?'workspaces':action==='save-folder'?'folders':'labels';
  const name=kind==='labels'?labelName.parse(p.name.replace(/^#/,'')):p.name;
  if(kind!=='workspaces')await localWorkspace(p.workspaceId!);
  const existing=await localRows<{id:string;name:string;workspaceId?:string}>(kind);
  const duplicate=existing.find(v=>v.name.toLowerCase()===name.toLowerCase()&&v.workspaceId===p.workspaceId&&v.id!==p.id);
  if(duplicate){if(kind==='labels')return;throw new Error('That name is already in use.');}
  await write(localRef(kind,p.id),{name,...kind==='workspaces'?{}:{workspaceId:p.workspaceId}});return;
 }
 if(action==='save-timer'){
  const p=timerInput.parse(payload);if(p.resetEnabled)assertTimerDate(p.kind,p.startedAt);if(p.kind==='until'&&p.counter)throw new Error('Countdown timers do not have counters.');await localWorkspace(p.workspaceId);
  if(p.folderId){const folders=await localRows<Snapshot['folders'][number]>('folders');if(!folders.some(f=>f.id===p.folderId&&f.workspaceId===p.workspaceId))throw new Error('Choose a folder in this workspace.');}
  const history=(await localRows<Event>('events')).filter(e=>e.timerId===p.id);const first=history.map(e=>e.happenedAt).sort()[0];
  if(first&&(p.kind!=='since'||p.startedAt>first))throw new Error('Keep the start on or before the first recorded event.');
  await write(localRef('timers',p.id),{...p,startedAtMs:Date.parse(p.startedAt),endedAtMs:p.endedAt?Date.parse(p.endedAt):null});return;
 }
 if(action==='record-event'){
  const p=eventInput.parse(payload),tr=localRef('timers',p.timerId),er=localRef('events',p.id);
  await runTransaction(firestore,async tx=>{const [t,e]=await Promise.all([tx.get(tr),tx.get(er)]);if(!t.exists())throw new Error('Timer not found.');const timer=t.data() as Timer;
   if(!timer.resetEnabled||timer.kind!=='since')throw new Error('Resets are disabled for this timer.');assertEventDate(p.happenedAt,timer.startedAt);
   if(e.exists()){if(e.data().timerId!==p.timerId)throw new Error('Event identifier already used.');return;}
   tx.set(er,{...p,happenedAtMs:Date.parse(p.happenedAt),createdAt:new Date().toISOString()});});return;
 }
 if(action==='delete-event'){
  const r=localRef('events',String(payload.id));await runTransaction(firestore,async tx=>{const e=await tx.get(r);if(e.exists()&&e.data().timerId!==payload.timerId)throw new Error('Event not found.');tx.delete(r);});return;
 }
 if(action==='delete-timer'){
  const id=String(payload.id);const events=(await localRows<Event>('events')).filter(e=>e.timerId===id);await remove([localRef('timers',id),...events.map(e=>localRef('events',e.id))]);return;
 }
 if(action==='delete-folder'){
  const id=String(payload.id),timers=(await localRows<Timer>('timers')).filter(t=>t.folderId===id);
  for(let i=0;i<timers.length;i+=400){const batch=writeBatch(firestore);timers.slice(i,i+400).forEach(t=>batch.update(localRef('timers',t.id),{folderId:null}));await batch.commit();}await remove([localRef('folders',id)]);return;
 }
 if(action==='delete-workspace'){
  const id=String(payload.id),data=await snapshot();if(data.workspaces.length<2)throw new Error('Keep at least one workspace.');
  const timers=data.timers.filter(t=>t.workspaceId===id),ids=new Set(timers.map(t=>t.id)),events=(await localRows<Event>('events')).filter(e=>ids.has(e.timerId));
  await remove([...events.map(e=>localRef('events',e.id)),...timers.map(t=>localRef('timers',t.id)),...data.labels.filter(l=>l.workspaceId===id).map(l=>localRef('labels',l.id)),...data.folders.filter(f=>f.workspaceId===id).map(f=>localRef('folders',f.id)),localRef('workspaces',id)]);return;
 }
 throw new Error('Unknown action.');
}

export async function requestJSON<T>(url:string,options?:RequestInit):Promise<T>{
 try{if(options?.method==='POST'){await mutate(JSON.parse(String(options.body)));return {ok:true} as T;}
 const timer=new URL(url,'https://local.invalid').searchParams.get('timer');if(timer){const events=(await rows<Event>('events')).filter(e=>e.timerId===timer).sort((a,b)=>b.happenedAt.localeCompare(a.happenedAt));return {events} as T;}return await snapshot() as T;
 }catch(e){const code=(e as {code?:string}).code;if(code==='permission-denied')throw new Error('Firestore access was denied. Check the database rules for this project.');if(code==='unavailable')throw new Error('Unable to sync with Firestore. Check your connection and retry.');if((e as Error).name==='ZodError')throw new Error('Check the required fields, dates and labels.');throw e;}
}

export async function exportData(scope:string,format:string){
 const account=uid(),data=await snapshot(),workspaces=data.workspaces.filter(w=>scope==='all'||w.id===scope),ids=new Set(workspaces.map(w=>w.id));
 const timers=data.timers.filter(t=>ids.has(t.workspaceId)),timerIds=new Set(timers.map(t=>t.id)),events=(await rows<Event>('events',account)).filter(e=>timerIds.has(e.timerId)),folders=data.folders.filter(f=>ids.has(f.workspaceId)),labels=data.labels.filter(l=>ids.has(l.workspaceId));
 const result={version:2,exportedAt:new Date().toISOString(),scope,workspaces,folders,labels,timers,events};
 if(format==='json')return new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
 const names=new Map(workspaces.map(w=>[w.id,w.name])),folderNames=new Map(folders.map(f=>[f.id,f.name])),timerMap=new Map(timers.map(t=>[t.id,t]));
 const records=[...workspaces.map(w=>({record_type:'workspace',id:w.id,workspace_id:w.id,workspace_name:w.name,name:w.name})),...folders.map(f=>({record_type:'folder',id:f.id,workspace_id:f.workspaceId,workspace_name:names.get(f.workspaceId),name:f.name})),...labels.map(l=>({record_type:'label',id:l.id,workspace_id:l.workspaceId,workspace_name:names.get(l.workspaceId),name:l.name})),...timers.map(t=>({record_type:'timer',id:t.id,workspace_id:t.workspaceId,workspace_name:names.get(t.workspaceId),folder_id:t.folderId,folder_name:t.folderId?folderNames.get(t.folderId):'',title:t.title,kind:t.kind,started_at:t.startedAt,ended_at:t.endedAt,reset_enabled:t.resetEnabled,counter_enabled:t.counter,labels:JSON.stringify(t.labels),color:t.color,count:t.count,last_event:t.lastEvent,note:t.note})),...events.map(e=>({record_type:'event',id:e.id,timer_id:e.timerId,workspace_id:timerMap.get(e.timerId)?.workspaceId,title:timerMap.get(e.timerId)?.title,event_time:e.happenedAt,created_at:e.createdAt,note:e.note}))];
 return new Blob([toCSV(['record_type','id','workspace_id','workspace_name','name','folder_id','folder_name','timer_id','title','kind','started_at','ended_at','reset_enabled','counter_enabled','labels','color','count','last_event','event_time','created_at','note'],records)],{type:'text/csv;charset=utf-8'});
}

import {applyOffline,readDevice,writeDevice,accountLock,type DeviceData,type Command} from './offline';
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

export async function serverSnapshot():Promise<Snapshot>{
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
  const r=localRef('timers',p.id);await runTransaction(firestore,async tx=>{const old=await tx.get(r);if(old.exists()&&old.data().deletedAt)throw new Error('This timer is in Trash. Restore it before editing.');tx.set(r,{...p,deletedAt:null,startedAtMs:Date.parse(p.startedAt),endedAtMs:p.endedAt?Date.parse(p.endedAt):null});});return;
 }
 if(action==='record-event'){
  const p=eventInput.parse(payload),tr=localRef('timers',p.timerId),er=localRef('events',p.id);
  await runTransaction(firestore,async tx=>{const [t,e]=await Promise.all([tx.get(tr),tx.get(er)]);if(!t.exists())throw new Error('Timer not found.');const timer=t.data() as Timer;
   if(timer.deletedAt)throw new Error('This timer is in Trash.');if(!timer.resetEnabled||timer.kind!=='since')throw new Error('Resets are disabled for this timer.');assertEventDate(p.happenedAt,timer.startedAt);
   if(e.exists()){if(e.data().timerId!==p.timerId)throw new Error('Event identifier already used.');return;}
   tx.set(er,{...p,happenedAtMs:Date.parse(p.happenedAt),createdAt:new Date().toISOString()});});return;
 }
 if(action==='delete-event'){
  const r=localRef('events',String(payload.id));await runTransaction(firestore,async tx=>{const e=await tx.get(r);if(e.exists()&&e.data().timerId!==payload.timerId)throw new Error('Event not found.');tx.delete(r);});return;
 }
 if(action==='delete-timer'||action==='restore-timer'){
  const r=localRef('timers',String(payload.id));await runTransaction(firestore,async tx=>{const t=await tx.get(r);if(!t.exists())throw new Error('Timer not found.');tx.update(r,{deletedAt:action==='delete-timer'?new Date().toISOString():null});});return;
 }
 if(action==='purge-timer'){
  const id=String(payload.id),r=localRef('timers',id),events=(await localRows<Event>('events')).filter(e=>e.timerId===id);await runTransaction(firestore,async tx=>{const t=await tx.get(r);if(!t.exists())return;if(!t.data().deletedAt)throw new Error('Move the timer to Trash before deleting it permanently.');events.forEach(e=>tx.delete(localRef('events',e.id)));tx.delete(r);});return;
 }
 if(action==='delete-folder'){
  const id=String(payload.id),timers=(await localRows<Timer>('timers')).filter(t=>t.folderId===id);
  for(let i=0;i<timers.length;i+=400){const batch=writeBatch(firestore);timers.slice(i,i+400).forEach(t=>batch.update(localRef('timers',t.id),{folderId:null}));await batch.commit();}await remove([localRef('folders',id)]);return;
 }
 if(action==='delete-workspace'){
  const id=String(payload.id),data=await serverSnapshot();if(data.workspaces.length<2)throw new Error('Keep at least one workspace.');
  const timers=data.timers.filter(t=>t.workspaceId===id),ids=new Set(timers.map(t=>t.id)),events=(await localRows<Event>('events')).filter(e=>ids.has(e.timerId));
  await remove([...events.map(e=>localRef('events',e.id)),...timers.map(t=>localRef('timers',t.id)),...data.labels.filter(l=>l.workspaceId===id).map(l=>localRef('labels',l.id)),...data.folders.filter(f=>f.workspaceId===id).map(f=>localRef('folders',f.id)),localRef('workspaces',id)]);return;
 }
 throw new Error('Unknown action.');
}

export type SyncState={offline:boolean;pending:number};
let syncState:SyncState={offline:false,pending:0};let syncAccount='';
export function deviceSyncState(){return auth.currentUser?.uid===syncAccount?syncState:{offline:false,pending:0};}
function report(offline:boolean,pending:number){syncAccount=auth.currentUser?.uid??'';syncState={offline,pending};if(typeof window!=='undefined')window.dispatchEvent(new globalThis.Event('since-sync'));}
const disconnected=()=>typeof navigator!=='undefined'&&navigator.onLine===false;
function connectionError(e:unknown){return disconnected()||['unavailable','deadline-exceeded'].includes((e as {code?:string}).code??'');}
export async function requestJSON<T>(url:string,options?:RequestInit):Promise<T>{
 const account=uid();
 return accountLock(account,async()=>{
  try{
   let saved:DeviceData|undefined;try{saved=await readDevice(account);}catch(e){if(disconnected())throw e;}const isPost=options?.method==='POST';
   const command=isPost?JSON.parse(String(options.body)) as Command:undefined;
   const timerId=new URL(url,'https://local.invalid').searchParams.get('timer');
   const check=()=>{if(auth.currentUser?.uid!==account)throw Error('Account changed. Please try again.');};
   const cached=()=>{check();if(!saved)throw Error('Connect once to download your timers for offline use.');report(true,saved.outbox.length);return (timerId?{events:saved.events.filter(e=>e.timerId===timerId).sort((a,b)=>b.happenedAt.localeCompare(a.happenedAt))}:saved.data) as T;};
   const enqueue=async()=>{check();if(!saved)throw Error('Connect once before making offline changes.');if(typeof navigator!=='undefined'&&!navigator.locks)throw Error('This browser supports offline viewing only. Connect to save changes.');saved=applyOffline(saved,command!);await writeDevice(account,saved);check();report(true,saved.outbox.length);return {ok:true,pending:true} as T;};
   if(command?.action==='discard-pending'){if(disconnected())throw Error('Connect before discarding pending changes.');const data=await serverSnapshot(),events=await rows<Event>('events',account);check();await writeDevice(account,{data,events,outbox:[]});report(false,0);return {ok:true} as T;}
   if(disconnected())return command?enqueue():cached();
   try{
    while(saved?.outbox.length){check();await mutate(saved.outbox[0]);check();saved.outbox.shift();await writeDevice(account,saved);}
    if(command){check();await mutate(command);check();}
    const data=await serverSnapshot(),events=await rows<Event>('events',account);check();
    saved={data,events,outbox:[]};await writeDevice(account,saved).catch(()=>{});check();report(false,0);
    return (command?{ok:true}:timerId?{events:events.filter(e=>e.timerId===timerId).sort((a,b)=>b.happenedAt.localeCompare(a.happenedAt))}:data) as T;
   }catch(e){if(connectionError(e))return command?enqueue():cached();if(saved?.outbox.length)report(false,saved.outbox.length);throw e;}
  }catch(e){const code=(e as {code?:string}).code;if(code==='permission-denied')throw Error('Firestore access was denied. Check the database rules for this project.');if((e as Error).name==='ZodError')throw Error('Check the required fields, dates and labels.');throw e;}
 });
}

export async function exportData(scope:string,format:string){
 const account=uid(),device=await readDevice(account).catch(()=>undefined),data=device?.outbox.length?device.data:await requestJSON<Snapshot>('/api/tracker'),workspaces=data.workspaces.filter(w=>scope==='all'||w.id===scope),ids=new Set(workspaces.map(w=>w.id));
 const timers=data.timers.filter(t=>ids.has(t.workspaceId)),timerIds=new Set(timers.map(t=>t.id)),events=((await readDevice(account))?.events??await rows<Event>('events',account)).filter(e=>timerIds.has(e.timerId)),folders=data.folders.filter(f=>ids.has(f.workspaceId)),labels=data.labels.filter(l=>ids.has(l.workspaceId));
 if(auth.currentUser?.uid!==account)throw Error('Account changed. Please try again.');
 const result={version:3,pendingChanges:((await readDevice(account).catch(()=>undefined))?.outbox??[]).filter(c=>scope==='all'||ids.has(String(c.workspaceId))||(c.action==='save-workspace'&&ids.has(String(c.id)))||timerIds.has(String(c.timerId??c.id))),exportedAt:new Date().toISOString(),scope,workspaces,folders,labels,timers,events};
 if(format==='json')return new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
 const names=new Map(workspaces.map(w=>[w.id,w.name])),folderNames=new Map(folders.map(f=>[f.id,f.name])),timerMap=new Map(timers.map(t=>[t.id,t]));
 const records=[...workspaces.map(w=>({record_type:'workspace',id:w.id,workspace_id:w.id,workspace_name:w.name,name:w.name})),...folders.map(f=>({record_type:'folder',id:f.id,workspace_id:f.workspaceId,workspace_name:names.get(f.workspaceId),name:f.name})),...labels.map(l=>({record_type:'label',id:l.id,workspace_id:l.workspaceId,workspace_name:names.get(l.workspaceId),name:l.name})),...timers.map(t=>({record_type:'timer',id:t.id,workspace_id:t.workspaceId,workspace_name:names.get(t.workspaceId),folder_id:t.folderId,folder_name:t.folderId?folderNames.get(t.folderId):'',title:t.title,kind:t.kind,started_at:t.startedAt,ended_at:t.endedAt,reset_enabled:t.resetEnabled,counter_enabled:t.counter,labels:JSON.stringify(t.labels),color:t.color,text_color:t.textColor,precision:t.precision??'seconds',deleted_at:t.deletedAt,count:t.count,last_event:t.lastEvent,note:t.note})),...events.map(e=>({record_type:'event',id:e.id,timer_id:e.timerId,workspace_id:timerMap.get(e.timerId)?.workspaceId,title:timerMap.get(e.timerId)?.title,event_time:e.happenedAt,created_at:e.createdAt,note:e.note}))];
 return new Blob([toCSV(['record_type','id','workspace_id','workspace_name','name','folder_id','folder_name','timer_id','title','kind','started_at','ended_at','reset_enabled','counter_enabled','labels','color','text_color','precision','deleted_at','count','last_event','event_time','created_at','note'],records)],{type:'text/csv;charset=utf-8'});
}

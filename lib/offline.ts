import type {Snapshot, Event} from './timers';
import {timerInput,eventInput,namedInput,labelName,assertTimerDate,assertEventDate} from './validation';
export type Command=Record<string,unknown>;
export type DeviceData={data:Snapshot;events:Event[];outbox:Command[]};
export function applyOffline(current:DeviceData,command:Command):DeviceData{
 const next=structuredClone(current),data=next.data,action=command.action,id=String(command.id);
 const workspace=(id:string)=>{if(!data.workspaces.some(w=>w.id===id))throw Error('Workspace not found.');};
 const timer=()=>{const t=data.timers.find(t=>t.id===id);if(!t)throw Error('Timer not found.');return t;};
 if(action==='purge-timer'||action==='delete-workspace')throw Error('Connect to the internet before permanently deleting records.');
 if(action==='save-workspace'||action==='save-folder'||action==='save-label'){
  const p=namedInput.parse(command),kind=action==='save-workspace'?'workspaces':action==='save-folder'?'folders':'labels';
  if(kind!=='workspaces')workspace(p.workspaceId!);
  const name=kind==='labels'?labelName.parse(p.name.replace(/^#/,'')):p.name;
  const list=data[kind] as {id:string;name:string;workspaceId?:string}[];
  const duplicate=list.find(v=>v.id!==id&&v.name.toLowerCase()===name.toLowerCase()&&v.workspaceId===p.workspaceId);
  if(duplicate){if(kind==='labels')return next;throw Error('That name is already in use.');}
  const value={id,name,...kind==='workspaces'?{}:{workspaceId:p.workspaceId}};
  const index=list.findIndex(v=>v.id===id);if(index<0)list.push(value);else list[index]=value;
 }else if(action==='save-timer'){
  const p=timerInput.parse(command);workspace(p.workspaceId);if(p.resetEnabled)assertTimerDate(p.kind,p.startedAt);
  if(p.kind==='until'&&p.counter)throw Error('Countdown timers do not have counters.');
  if(p.folderId&&!data.folders.some(f=>f.id===p.folderId&&f.workspaceId===p.workspaceId))throw Error('Choose a folder in this workspace.');
  const index=data.timers.findIndex(t=>t.id===id);if(index>=0&&data.timers[index].deletedAt)throw Error('This timer is in Trash. Restore it before editing.');
  const first=next.events.filter(e=>e.timerId===id).map(e=>e.happenedAt).sort()[0];
  if(first&&(p.kind!=='since'||p.startedAt>first))throw Error('Keep the start on or before the first recorded event.');
  const value={...p,deletedAt:null,count:0,lastEvent:null};if(index<0)data.timers.push(value);else data.timers[index]=value;
 }else if(action==='record-event'){
  const p=eventInput.parse(command),t=data.timers.find(t=>t.id===p.timerId);if(!t)throw Error('Timer not found.');
  if(t.deletedAt)throw Error('This timer is in Trash.');if(t.resetEnabled===false||t.kind!=='since')throw Error('Resets are disabled for this timer.');assertEventDate(p.happenedAt,t.startedAt);
  const old=next.events.find(e=>e.id===id);if(old&&old.timerId!==p.timerId)throw Error('Event identifier already used.');
  if(!old)next.events.push({...p,createdAt:new Date().toISOString()});
 }else if(action==='delete-event'){
  if(next.events.some(e=>e.id===id&&e.timerId!==command.timerId))throw Error('Event not found.');next.events=next.events.filter(e=>e.id!==id);
 }else if(action==='delete-timer'||action==='restore-timer')timer().deletedAt=action==='delete-timer'?new Date().toISOString():null;
 else if(action==='delete-folder'){data.folders=data.folders.filter(f=>f.id!==id);data.timers.forEach(t=>{if(t.folderId===id)t.folderId=null;});}
 else throw Error('Unknown action.');
 for(const t of data.timers){const events=next.events.filter(e=>e.timerId===t.id);t.count=events.length;t.lastEvent=events.map(e=>e.happenedAt).sort().at(-1)??null;}
 next.outbox.push(command);return next;
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('since-device-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('accounts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Device storage is unavailable.'));});}
export const hasDeviceStorage=()=>typeof indexedDB!=='undefined';
export async function readDevice(account:string):Promise<DeviceData|undefined>{if(!hasDeviceStorage())return;const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('accounts').objectStore('accounts').get(account);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Unable to read saved timers on this device.'));});}
export async function writeDevice(account:string,value:DeviceData){if(!hasDeviceStorage())return;const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction('accounts','readwrite');tx.objectStore('accounts').put(value,account);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error('Unable to save on this device. Free some storage and retry.'));});}
const locks=new Map<string,Promise<unknown>>();
export async function accountLock<T>(account:string,operation:()=>Promise<T>):Promise<T>{
 if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request('since-sync-'+account,operation);
 const before=locks.get(account)??Promise.resolve();const task=before.catch(()=>{}).then(operation);locks.set(account,task);try{return await task;}finally{if(locks.get(account)===task)locks.delete(account);}
}

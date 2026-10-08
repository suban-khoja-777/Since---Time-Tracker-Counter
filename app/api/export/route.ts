import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/lib/storage';
import {toCSV} from '@/lib/export';
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Please sign in to export your data.'},{status:401});
  const url=new URL(request.url),scope=url.searchParams.get('workspace'),format=url.searchParams.get('format')??'json';
  if(!['csv','json'].includes(format))return Response.json({error:'Choose CSV or JSON.'},{status:400});
  const db=database(),where='w.owner=?'+(scope?' AND w.id=?':''),args=scope?[user.userId,scope]:[user.userId];
  const ws=await db.prepare('SELECT w.id,w.name FROM workspaces w WHERE '+where+' ORDER BY w.rowid').bind(...args).all();
  if(scope&&!ws.results.length)return Response.json({error:'Workspace not found.'},{status:404});
  const [fs,ls,ts,es]=await db.batch<Record<string,unknown>>([
   db.prepare('SELECT f.id,f.workspace_id AS workspaceId,f.name FROM folders f JOIN workspaces w ON w.id=f.workspace_id WHERE '+where).bind(...args),
   db.prepare('SELECT l.id,l.workspace_id AS workspaceId,l.name FROM label_definitions l JOIN workspaces w ON w.id=l.workspace_id WHERE '+where).bind(...args),
   db.prepare('SELECT t.id,t.workspace_id AS workspaceId,t.folder_id AS folderId,t.title,t.note,t.kind,t.started_at AS startedAt,t.reset_enabled AS resetEnabled,t.ended_at AS endedAt,t.counter,t.labels,t.color,(SELECT count(*) FROM events e WHERE e.timer_id=t.id) AS count,(SELECT max(happened_at) FROM events e WHERE e.timer_id=t.id) AS lastEvent FROM timers t JOIN workspaces w ON w.id=t.workspace_id WHERE '+where).bind(...args),
   db.prepare('SELECT e.id,e.timer_id AS timerId,t.workspace_id AS workspaceId,e.happened_at AS happenedAt,e.note,e.created_at AS createdAt FROM events e JOIN timers t ON t.id=e.timer_id JOIN workspaces w ON w.id=t.workspace_id WHERE '+where+' ORDER BY e.happened_at').bind(...args)
  ]);
  const timers:Record<string,unknown>[]=ts.results.map(t=>({...t,resetEnabled:!!t.resetEnabled,counter:!!t.counter,labels:JSON.parse(t.labels as string)}));
  const workspaceNames=new Map(ws.results.map(w=>[w.id,w.name])),folderNames=new Map(fs.results.map(f=>[f.id,f.name]));
  const result={version:1,exportedAt:new Date().toISOString(),scope:scope??'all',workspaces:ws.results,folders:fs.results,labels:ls.results,timers,events:es.results};
  const filename='since-'+(scope?'workspace':'all')+'-'+new Date().toISOString().slice(0,10)+'.'+format;
  const headers={'Content-Type':format==='json'?'application/json; charset=utf-8':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'no-store'};
  if(format==='json')return new Response(JSON.stringify(result,null,2),{headers});
  const timerMap=new Map(timers.map(t=>[t.id,t]));
  const rows:Record<string,unknown>[]=[...ws.results.map(w=>({record_type:'workspace',id:w.id,workspace_id:w.id,workspace_name:w.name,name:w.name})),...fs.results.map(f=>({record_type:'folder',id:f.id,workspace_id:f.workspaceId,workspace_name:workspaceNames.get(f.workspaceId),name:f.name})),...ls.results.map(l=>({record_type:'label',id:l.id,workspace_id:l.workspaceId,workspace_name:workspaceNames.get(l.workspaceId),name:l.name})),...timers.map(t=>({record_type:'timer',id:t.id,workspace_id:t.workspaceId,workspace_name:workspaceNames.get(t.workspaceId),folder_id:t.folderId,folder_name:folderNames.get(t.folderId),title:t.title,kind:t.kind,started_at:t.startedAt,reset_enabled:t.resetEnabled,ended_at:t.endedAt,counter_enabled:t.counter,labels:JSON.stringify(t.labels),color:t.color,count:t.count,last_event:t.lastEvent,note:t.note})),...es.results.map(e=>({record_type:'event',id:e.id,workspace_id:e.workspaceId,workspace_name:workspaceNames.get(e.workspaceId),timer_id:e.timerId,title:timerMap.get(e.timerId)?.title,event_time:e.happenedAt,created_at:e.createdAt,note:e.note}))];
  return new Response(toCSV(['record_type','id','workspace_id','workspace_name','name','folder_id','folder_name','timer_id','title','kind','started_at','reset_enabled','ended_at','counter_enabled','labels','color','count','last_event','event_time','created_at','note'],rows),{headers});
 }catch(e){console.error('Export failed',e);return Response.json({error:'Could not export your saved data. Please try again.'},{status:503})}
}

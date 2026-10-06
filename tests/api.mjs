import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const headers={cookie,'Content-Type':'application/json'};
async function get(path='/api/tracker'){const r=await fetch(base+path,{headers});assert.equal(r.status,200);return r.json()}
async function post(data,status=200){const r=await fetch(base+'/api/tracker',{method:'POST',headers,body:JSON.stringify(data)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b}
const initial=await get();const ws=crypto.randomUUID(),folder=crypto.randomUUID(),id=crypto.randomUUID();
try {
 await post({action:'save-workspace',id:ws,name:'API verification '+ws.slice(0,8)});
 await post({action:'save-folder',id:folder,workspaceId:ws,name:'Health'});
 const timer={id,workspaceId:ws,folderId:folder,title:'Fast food',note:'Test fixture',kind:'since',startedAt:new Date(Date.now()-10*86400000).toISOString(),counter:true,labels:['Food','health'],color:'peach',emoji:'🍔'};
 await post({action:'save-timer',...timer});
 let saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.count,0);assert.deepEqual(saved.labels,['food','health']);
 const event={id:crypto.randomUUID(),timerId:id,happenedAt:new Date(Date.now()-2*3600000).toISOString(),note:'Ate fast food'};
 await post({action:'record-event',...event});await post({action:'record-event',...event});
 saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.count,1);assert.equal(saved.lastEvent,event.happenedAt);
 const older={id:crypto.randomUUID(),timerId:id,happenedAt:new Date(Date.now()-2*86400000).toISOString(),note:'Backdated event'};
 await post({action:'record-event',...older});saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.count,2);assert.equal(saved.lastEvent,event.happenedAt);
 await post({action:'record-event',...older,id:crypto.randomUUID(),happenedAt:new Date(Date.now()+86400000).toISOString()},400);
 await post({action:'record-event',...older,id:crypto.randomUUID(),happenedAt:new Date(Date.now()-20*86400000).toISOString()},400);
 await post({action:'save-timer',...timer,counter:false});saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.counter,false);assert.equal(saved.count,2);
 await post({action:'save-timer',...timer});assert.equal((await get('/api/tracker?timer='+id)).events.length,2);
 await post({action:'delete-event',id:event.id,timerId:id});saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.count,1);assert.equal(saved.lastEvent,older.happenedAt);
 await post({action:'delete-event',id:older.id,timerId:id});saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.count,0);assert.equal(saved.lastEvent,null);
 await post({action:'save-timer',...timer,id:crypto.randomUUID(),workspaceId:initial.workspaces[0].id},400);
 await post({action:'delete-folder',id:folder,workspaceId:ws});saved=(await get()).timers.find(t=>t.id===id);assert.equal(saved.folderId,null);
 const countdown={...timer,id:crypto.randomUUID(),folderId:null,kind:'until',counter:false,startedAt:new Date(Date.now()+86400000).toISOString()};await post({action:'save-timer',...countdown});await post({action:'record-event',...event,id:crypto.randomUUID(),timerId:countdown.id},400);
 const anonymous=await fetch(base+'/api/tracker');assert.equal(anonymous.status,401);
 const csrf=await fetch(base+'/api/tracker',{method:'POST',headers:{...headers,Origin:'https://wrong.example'},body:JSON.stringify({action:'delete-timer',id})});assert.equal(csrf.status,403);
 console.log('PASS: Fast-food reset/count, idempotency, backdating, validation, counter toggling, history, folder scope, countdown, anonymous rejection and CSRF.');
}finally{await post({action:'delete-workspace',id:ws});assert.equal((await get()).timers.some(t=>t.workspaceId===ws),false);console.log('PASS: workspace deletion cascades and test data cleaned up.');}

import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';const headers={cookie:'__sites_local_auth=1','Content-Type':'application/json'};
async function post(data,status=200){const r=await fetch(base+'/api/tracker',{method:'POST',headers,body:JSON.stringify(data)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b}
const ws=crypto.randomUUID(),id=crypto.randomUUID();
try{await post({action:'save-workspace',id:ws,name:'Lifecycle verification '+ws.slice(0,8)});
const t={action:'save-timer',id,workspaceId:ws,folderId:null,title:'Phone life',note:'Lifecycle test fixture',kind:'since',startedAt:'2026-10-01T00:00:00.000Z',resetEnabled:false,endedAt:'2026-10-04T00:00:00.000Z',counter:false,labels:['devices'],color:'#448AFF'};
await post(t);let data=await (await fetch(base+'/api/tracker',{headers})).json();const saved=data.timers.find(t=>t.id===id);assert.equal(saved.resetEnabled,false);assert.equal(saved.endedAt,t.endedAt);
await post({action:'record-event',id:crypto.randomUUID(),timerId:id,happenedAt:new Date().toISOString(),note:''},400);
await post({...t,endedAt:'2026-09-01T00:00:00.000Z'},400);await post({...t,resetEnabled:true},400);
const exported=await (await fetch(base+'/api/export?workspace='+ws,{headers})).json();assert.equal(exported.timers[0].resetEnabled,false);assert.equal(exported.timers[0].endedAt,t.endedAt);
await post({...t,startedAt:new Date(Date.now()+86400000).toISOString(),endedAt:null});data=await (await fetch(base+'/api/tracker',{headers})).json();assert.equal(data.timers.find(t=>t.id===id).endedAt,null);
console.log('PASS: lifetime settings persist; disabled resets rejected; end ordering validated; future start accepted; lifecycle fields exported.');
}finally{await post({action:'delete-workspace',id:ws})}

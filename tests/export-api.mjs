import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),headers={cookie:login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),'Content-Type':'application/json'};
async function post(p){const r=await fetch(base+'/api/tracker',{method:'POST',headers,body:JSON.stringify(p)});assert.equal(r.status,200,await r.text())}
const ws=crypto.randomUUID(),id=crypto.randomUUID(),label=crypto.randomUUID(),event=crypto.randomUUID();
try{
 await post({action:'save-workspace',id:ws,name:'Export verification '+ws.slice(0,8)});
 await post({action:'save-label',id:label,workspaceId:ws,name:' Unused label '});
 let snapshot=await(await fetch(base+'/api/tracker',{headers})).json();assert.ok(snapshot.labels.some(l=>l.name==='unused label'&&l.workspaceId===ws));
 await post({action:'save-timer',id,workspaceId:ws,folderId:null,title:'=1+1',note:'Comma, "quote"\nnew line',kind:'since',startedAt:'2026-10-01T00:00:00Z',counter:true,labels:['unused label'],color:'#FF5252'});
 await post({action:'record-event',id:event,timerId:id,happenedAt:'2026-10-05T10:30:00Z',note:'An event'});
 const r=await fetch(base+'/api/export?workspace='+ws+'&format=json',{headers});assert.equal(r.status,200);assert.ok(r.headers.get('content-disposition').includes('.json'));const j=await r.json();assert.equal(j.workspaces.length,1);assert.equal(j.timers.length,1);assert.equal(j.timers[0].color,'#FF5252');assert.equal(j.timers[0].count,1);assert.equal(j.labels[0].name,'unused label');assert.equal(j.events[0].id,event);
 const csv=await(await fetch(base+'/api/export?workspace='+ws+'&format=csv',{headers})).text();assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"event"'));assert.ok(csv.includes('"label"'));assert.ok(csv.includes('"timer"'));assert.ok(csv.includes('"Comma, ""quote""\nnew line"'));
 const all=await(await fetch(base+'/api/export?format=json',{headers})).json();assert.ok(all.workspaces.length>=2);assert.ok(all.timers.some(t=>t.id===id));
 assert.equal((await fetch(base+'/api/export?format=json')).status,401);assert.equal((await fetch(base+'/api/export?workspace=not-mine&format=json',{headers})).status,404);
 assert.equal((await fetch(base+'/api/export?format=pdf',{headers})).status,400);
 console.log('PASS: standalone sidebar labels, custom colors, complete workspace/all JSON and CSV, history, formula escaping and export access checks.');
}finally{await post({action:'delete-workspace',id:ws})}

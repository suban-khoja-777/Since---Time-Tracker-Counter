import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',ws=crypto.randomUUID(),id=crypto.randomUUID();
function sql(command){execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{stdio:'pipe'})}
sql(`INSERT INTO workspaces (id,owner,name) VALUES ('${ws}','isolation-fixture','Another account'); INSERT INTO timers (id,workspace_id,title,started_at) VALUES ('${id}','${ws}','Private timer','2026-10-01T00:00:00.000Z');`);
try{
 const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const headers={cookie,'Content-Type':'application/json'};
 const data=await (await fetch(base+'/api/tracker',{headers})).json();assert.equal(data.workspaces.some(w=>w.id===ws),false);assert.equal(data.timers.some(t=>t.id===id),false);
 for(const action of [{action:'save-workspace',id:ws,name:'Hijack'},{action:'save-folder',id:crypto.randomUUID(),workspaceId:ws,name:'Hijack'},{action:'delete-workspace',id:ws},{action:'delete-timer',id},{action:'record-event',id:crypto.randomUUID(),timerId:id,happenedAt:'2026-10-05T00:00:00Z',note:''}]){const r=await fetch(base+'/api/tracker',{method:'POST',headers,body:JSON.stringify(action)});assert.equal(r.status,404,JSON.stringify(action))}
 assert.equal((await fetch(base+'/api/tracker?timer='+id,{headers})).status,404);
 console.log('PASS: another account’s workspace, folder, timer, events and history cannot be read or changed.');
}finally{sql(`DELETE FROM timers WHERE id='${id}'; DELETE FROM workspaces WHERE id='${ws}';`)}

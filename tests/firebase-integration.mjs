// Explicit opt-in: creates disposable accounts and only their own test data.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,deleteUser} from 'firebase/auth';
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,writeBatch} from 'firebase/firestore';
import {auth,firestore,firebaseConfig,requestJSON,exportData} from '../.sites-runtime/firebase-integration-entry.mjs';
if(process.env.SINCE_FIREBASE_TESTS!=='1')throw new Error('Set SINCE_FIREBASE_TESTS=1 to run disposable Firebase account checks.');
const password='Test-'+crypto.randomUUID()+'!';const email='since-check-'+crypto.randomUUID()+'@example.test';
let first,second,secondApp;
const post=async p=>{try{return await requestJSON('/api/tracker',{method:'POST',body:JSON.stringify(p)});}catch(e){if(!/Trash|disabled/.test(e.message))console.error('Failed test action: '+p.action);throw e;}};
async function clean(db,user){for(const name of ['events','timers','folders','labels','workspaces']){const rows=await getDocs(collection(db,'users',user.uid,name));if(rows.empty)continue;const batch=writeBatch(db);rows.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}await deleteUser(user);}
try{
 first=(await createUserWithEmailAndPassword(auth,email,password)).user;
 let data=await requestJSON('/api/tracker');assert.equal(data.workspaces.length,1);assert.equal(data.timers.length,0);
 const ws=data.workspaces[0].id,folder=crypto.randomUUID(),id=crypto.randomUUID(),event=crypto.randomUUID();
 await post({action:'save-folder',id:folder,name:'Health',workspaceId:ws});await post({action:'save-label',id:crypto.randomUUID(),name:'Food',workspaceId:ws});
 const timer={textColor:'white',action:'save-timer',id,workspaceId:ws,folderId:folder,title:'Fast food',note:'Disposable test fixture',kind:'since',startedAt:new Date(Date.now()-10*86400000).toISOString(),resetEnabled:true,endedAt:null,counter:true,labels:['food'],color:'#FF1744'};
 await post(timer);const p={action:'record-event',id:event,timerId:id,happenedAt:new Date(Date.now()-3600000).toISOString(),note:'test reset'};await post(p);await post(p);
 data=await requestJSON('/api/tracker');assert.equal(data.timers[0].count,1);assert.equal(data.timers[0].lastEvent,p.happenedAt);assert.equal(data.labels[0].name,'food');
 await post({action:'delete-timer',id});data=await requestJSON('/api/tracker');assert.ok(data.timers.find(t=>t.id===id).deletedAt);assert.equal(data.timers.find(t=>t.id===id).count,1);await assert.rejects(post({...p,id:crypto.randomUUID()}),/Trash/);await assert.rejects(post(timer),/Trash/);await post({action:'restore-timer',id});data=await requestJSON('/api/tracker');assert.equal(data.timers.find(t=>t.id===id).deletedAt,null);assert.equal(data.timers.find(t=>t.id===id).count,1);assert.equal(data.timers.find(t=>t.id===id).textColor,'white');
 await signOut(auth);await signInWithEmailAndPassword(auth,email,password);data=await requestJSON('/api/tracker');assert.equal(data.timers[0].count,1);
 const phone={...timer,id:crypto.randomUUID(),title:'Phone life',folderId:null,resetEnabled:false,counter:false,endedAt:new Date(Date.now()-86400000).toISOString()};await post(phone);
 await assert.rejects(post({...p,id:crypto.randomUUID(),timerId:phone.id}),/Resets are disabled/);
 const blocked=crypto.randomUUID();await assert.rejects(setDoc(doc(firestore,'users',first.uid,'events',blocked),{id:blocked,timerId:phone.id,happenedAt:p.happenedAt,happenedAtMs:Date.parse(p.happenedAt),createdAt:p.happenedAt,note:''}),e=>e.code==='permission-denied');
 const json=JSON.parse(await (await exportData('all','json')).text());assert.equal(json.timers.length,2);assert.equal(json.events.length,1);assert.match(await (await exportData(ws,'csv')).text(),/reset_enabled/);
 secondApp=initializeApp(firebaseConfig,'isolation-check-'+crypto.randomUUID());const secondAuth=getAuth(secondApp),secondDb=getFirestore(secondApp);
 second=(await createUserWithEmailAndPassword(secondAuth,'since-check-'+crypto.randomUUID()+'@example.test',password)).user;
 await assert.rejects(getDoc(doc(secondDb,'users',first.uid,'timers',id)),e=>e.code==='permission-denied');
 await assert.rejects(setDoc(doc(secondDb,'users',first.uid,'workspaces','intruder'),{name:'Unauthorized'}),e=>e.code==='permission-denied');
 await deleteUser(second);second=null;await deleteApp(secondApp);secondApp=null;
 await post({action:'delete-timer',id:phone.id});await post({action:'purge-timer',id:phone.id});data=await requestJSON('/api/tracker');assert.equal(data.timers.some(t=>t.id===phone.id),false);await assert.rejects(post({action:'purge-timer',id}),/Trash/);
 await post({action:'delete-event',id:event,timerId:id});data=await requestJSON('/api/tracker');assert.equal(data.timers.find(t=>t.id===id).count,0);
 await clean(firestore,auth.currentUser);first=null;
 await assert.rejects(getDoc(doc(firestore,'users','anonymous-check','timers','x')),e=>e.code==='permission-denied');
 console.log('PASS: Firebase signup/sign-in, persistence, labels/folders, reset idempotency, lifecycle, text color, trash/restore/purge, exports, rule enforcement, cross-account and anonymous isolation. Test accounts and data removed.');
}catch(e){console.error('Firebase verification failed: '+e.message);process.exitCode=1;}finally{
 if(second&&secondApp)await clean(getFirestore(secondApp),second).catch(()=>{});
 if(first&&auth.currentUser)await clean(firestore,auth.currentUser).catch(()=>{});
 if(secondApp)await deleteApp(secondApp);
 process.exit(process.exitCode??0);
}

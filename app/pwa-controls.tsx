'use client';
import {useEffect,useState} from 'react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function PwaRuntime(){
 const[waiting,setWaiting]=useState<ServiceWorker|null>(null);
 useEffect(()=>{if(!('serviceWorker'in navigator))return;let cancelled=false;
  const watch=(r:ServiceWorkerRegistration)=>{if(cancelled)return;const cache=()=>r.active?.postMessage({type:'CACHE_APP_SHELL'});cache();void navigator.serviceWorker.ready.then(cache);if(r.waiting)setWaiting(r.waiting);r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller&&!cancelled)setWaiting(worker);});});};
  void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(watch).catch(()=>{});
  return()=>{cancelled=true;};
 },[]);
 function update(){navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting?.postMessage({type:'ACTIVATE_UPDATE'});}
 return waiting?<div className="pwa-update" role="status">An app update is ready. Save or sync your changes first.<button onClick={update}>Update app</button></div>:null;
}
export function InstallApp(){
 const[prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(true),[help,setHelp]=useState(false),[ios,setIos]=useState(false);
 useEffect(()=>{const media=matchMedia('(display-mode: standalone)');const detect=()=>setInstalled(media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);detect();setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
  const offer=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt);};const done=()=>{setInstalled(true);setPrompt(null);};
  window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',done);media.addEventListener('change',detect);
  return()=>{window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',done);media.removeEventListener('change',detect);};
 },[]);
 async function install(){if(!prompt){setHelp(v=>!v);return;}try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);}catch{setHelp(true);}finally{setPrompt(null);}}
 if(installed)return null;
 return <div className="pwa-install"><button type="button" className="secondary-button" onClick={()=>void install()}>Install app</button>{help&&<p className="form-help">{ios?'Open in Safari, tap Share, then Add to Home Screen.':'Open in Chrome or Edge and use the browser menu’s Install app or Add to home screen option. If the option is missing, visit the app again after signing in.'}</p>}</div>;
}

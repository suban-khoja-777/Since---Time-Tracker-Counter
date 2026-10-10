const CACHE='since-pwa-__BUILD__';
const FIXED=['/offline.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/favicon.svg','/logo.svg','/favicon.png','/apple-touch-icon.png'];
async function cacheShell(cache){try{const response=await fetch('/',{credentials:'same-origin',cache:'no-store'});if(response.ok&&!response.redirected&&(response.headers.get('content-type')||'').includes('text/html')){const text=await response.clone().text();if(text.includes('name="since-app-shell"'))await cache.put('/',response);}}catch{}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FIXED);let assets=[];try{const r=await fetch('/pwa-assets.json',{cache:'no-store'});if(r.ok)assets=await r.json();}catch{}await cache.addAll(assets.filter(p=>typeof p==='string'&&p.startsWith('/_next/')));await cacheShell(cache);})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('since-pwa-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CACHE_APP_SHELL')event.waitUntil(caches.open(CACHE).then(cacheShell));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&url.pathname==='/'){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok&&!response.redirected&&(response.headers.get('content-type')||'').includes('text/html')){const text=await response.clone().text();if(text.includes('name="since-app-shell"'))await cache.put('/',response.clone());}return response;}catch{return await cache.match('/')||await cache.match('/offline.html');}})());return;
 }
 // Never cache Auth, APIs, Firestore, or RSC data requests.
 const asset=url.pathname.startsWith('/_next/')&&['script','style','font','image'].includes(request.destination);
 if(asset||FIXED.includes(url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;})());
});

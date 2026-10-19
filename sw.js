/* Baffling Notes service worker: safe, versioned app-shell updates.
   BUILD must match <meta name="app-build"> in index.html (release.py stamps both).
   - Everything is precached into ONE cache named for the build, all-or-nothing; the page is only ever served from that single cache, so old and new files never mix.
   - A new version waits until the app tells it to take over (or all tabs close), so an editing session is never interrupted.
   - Only caches created by this app (bn-shell-* and the legacy bn-vN) are ever deleted. User data (IndexedDB/localStorage) is never touched here. */
const BUILD="2026-10-17.5",PREFIX="bn-shell-",CACHE=PREFIX+BUILD,SCOPE=self.registration.scope;
const ASSETS=["index.html","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","apple-touch-icon.png"],U=p=>new URL(p,SCOPE).href;
self.addEventListener("install",e=>e.waitUntil((async()=>{
  try{
    const res=await Promise.all(ASSETS.map(a=>fetch(new Request(U(a),{cache:"reload"}))));      // bypass HTTP cache: never install stale copies
    res.forEach((r,i)=>{if(!r.ok)throw new Error("Bad response for "+ASSETS[i])});
    const html=await res[0].clone().text();
    if(!html.includes('name="app-build" content="'+BUILD+'"'))throw new Error("index.html build does not match sw.js build");
    const c=await caches.open(CACHE);await Promise.all(res.map((r,i)=>c.put(U(ASSETS[i]),r)));
  }catch(err){await caches.delete(CACHE);throw err}                                              // failed install: old version stays active
})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==CACHE&&(k.startsWith(PREFIX)||/^bn-v\d+$/.test(k)))await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin||!u.href.startsWith(SCOPE))return;
  const nav=r.mode==="navigate"||u.href===SCOPE,key=nav?U("index.html"):u.origin+u.pathname;
  e.respondWith((async()=>{const c=await caches.open(CACHE),hit=await c.match(key);return hit||(nav&&await c.match(U("index.html")))||fetch(r)})());
});

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
const root = join(process.cwd(), "out");
async function walk(dir) {
  const results = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) results.push(...(await walk(p)));
    else results.push(p);
  }
  return results;
}
const files = (await walk(root)).filter(
  (p) => !p.endsWith("sw.js") && !p.endsWith(".map"),
);
const hash = createHash("sha256");
for (const p of files) hash.update(await readFile(p));
const version = hash.digest("hex").slice(0, 14);
const assets = files
  .map((p) => "/" + relative(root, p).replaceAll("\\", "/"))
  .map((p) => (p.endsWith("/index.html") ? p.slice(0, -10) : p));
const sw = `const CACHE='cadran-${version}';
const ASSETS=${JSON.stringify([...new Set(assets)])};
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('cadran-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const req=event.request;const url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;if(url.pathname==='/sw.js')return;const key=url.pathname;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate'){try{const response=await fetch(req);if(response.ok)await cache.put(key,response.clone());return response;}catch{return await cache.match(key)||await cache.match('/404.html')||new Response('Cette page est indisponible hors ligne.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}}const cached=await cache.match(key);if(cached)return cached;try{const response=await fetch(req);if(response.ok&&response.type==='basic')await cache.put(key,response.clone());return response;}catch{return new Response('',{status:503});}})());});
`;
await writeFile(join(root, "sw.js"), sw);
console.log(`PWA: ${assets.length} local assets precached · ${version}`);

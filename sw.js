/* AGC Connect service worker: keeps the app and the Ask Pastor Santosh data on the phone so they open fast and work with weak or no internet. */
const SHELL = 'agc-shell-v1', DATA = 'agc-data-v1';
const BIG = /\/data\/(bible-web|step|strongs|topics|ask|i18n)\.json$|\/data\/dict\/[a-z]\.json$/;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (![SHELL, DATA].includes(k)) await caches.delete(k); await self.clients.claim(); })());
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (BIG.test(u.pathname)) { // big, rarely changing data: cache first, refresh in the background
    e.respondWith((async () => {
      const c = await caches.open(DATA), hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }
  e.respondWith((async () => { // everything else: network first, fall back to the saved copy
    const c = await caches.open(SHELL);
    try { const res = await fetch(r); if (res && res.ok && !u.pathname.includes('/prayer/')) c.put(r, res.clone()); return res; }
    catch (err) { const hit = await c.match(r) || (r.mode === 'navigate' ? await c.match('index.html') || await c.match('./') : null); return hit || new Response('', { status: 504 }); }
  })());
});

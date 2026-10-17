// Service worker : garde l'app, le texte, le minutage et les polices pour un usage hors connexion.
// L'audio téléchargé est stocké à part (IndexedDB) par la page elle-même.
const VERSION = 'kahf-v14';
const SHELL = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('./index.html');
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Audio : lecture en flux, jamais mise en cache ici (fichiers trop lourds, requêtes partielles)
  if (req.destination === 'audio' || /\.(mp3|m4a|ogg)$/i.test(url.pathname) || req.headers.has('range')) return;

  // Polices Google
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
    return;
  }

  // Texte, récitateurs et minutage quran.com
  if (/(^|\.)quran\.com$|(^|\.)qurancdn\.com$|(^|\.)quranenc\.com$/.test(url.hostname)) {
    e.respondWith(networkFirst(req));
    return;
  }

  // L'app elle-même : toujours la dernière version si internet, sinon la copie gardée
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
});

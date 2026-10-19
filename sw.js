/* Service Worker pour l'application Gestion scolaire */
const CACHE_NAME = 'gestion-surveillant-v16';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './common.js',
  './school-config.js',
  './storage.js',
  './classes.js',
  './eleves.js',
  './enseignants.js',
  './billets.js',
  './exclusions.js',
  './notes.js',
  './app.js',
  './modal-actions.js',
  './manifest.json',
  './pointage-scolaire.html',
  './pointage-eleves-complet.html'
];

// Installation : prépare le nouveau cache avant de remplacer l'ancien.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation : supprime les anciennes versions du cache puis prend le contrôle.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Navigation réseau en priorité pour éviter de garder une ancienne page HTML.
// Les ressources statiques restent disponibles hors ligne via le cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

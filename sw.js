// RAF Manager — Service Worker
// Cache stratégie : Cache-first pour les assets statiques

const CACHE_NAME = 'raf-manager-v1';
const APP_SHELL = [
  './app_v4.html',
  './manifest.json'
];

// Installation : mise en cache de l'app shell
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    }).catch(err => {
      console.log('[SW] Cache install error:', err);
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch : Network-first pour les requêtes Supabase, Cache-first pour les assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes Supabase (toujours en ligne)
  if (url.hostname.includes('supabase.co')) {
    return; // laisser passer sans interception
  }

  // Pour les fichiers de l'app : Network-first avec fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache la réponse si OK
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Hors ligne : servir depuis le cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback sur app_v4.html pour la navigation
          if (event.request.mode === 'navigate') {
            return caches.match('./app_v4.html');
          }
          return new Response('Hors ligne', { status: 503 });
        });
      })
  );
});

// Message depuis l'app pour forcer la mise à jour
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

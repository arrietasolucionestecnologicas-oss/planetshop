const CACHE_NAME = 'planet-shop-v3.2';

// Instalación rápida
self.addEventListener('install', e => {
    self.skipWaiting();
});

// Activación y limpieza de cachés viejos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(() => clients.claim())
    );
});

// Estrategia Network-First (Cero Caché Zombi)
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});

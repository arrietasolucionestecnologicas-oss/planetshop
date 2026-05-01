const CACHE_NAME = 'planet-shop-v3.3'; // 🚀 BUMP de versión para forzar limpieza global en todos los dispositivos

const STATIC_ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './taxi.html',
    './manifest.json',
    './js/app.js',
    './js/api.js',
    './js/core.js',
    './js/state.js',
    './js/ui/pos.js',
    './js/ui/finance.js',
    './js/ui/inventory.js',
    './js/ui/crm.js'
];

// 1. INSTALACIÓN (Forzando la toma de control)
self.addEventListener('install', e => {
    self.skipWaiting(); // Obliga al SW nuevo a desplazar al viejo al instante
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Guarda los archivos estáticos vitales para el modo Offline
            return cache.addAll(STATIC_ASSETS).catch(err => console.warn('Algunos archivos estáticos no se encontraron:', err));
        })
    );
});

// 2. ACTIVACIÓN (Destrucción del Caché Zombi)
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Borrando caché antigua:', key);
                    return caches.delete(key); // Destruye cualquier rastro de la versión anterior
                }
            }));
        }).then(() => clients.claim()) // Toma el control inmediato de todas las pestañas abiertas
    );
});

// 3. ESTRATEGIA NETWORK-FIRST (Prioridad a red, respaldo en caché dinámica)
self.addEventListener('fetch', e => {
    // Ignorar peticiones de API (POST) o recursos externos que no deban cachearse
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request)
            .then(response => {
                // Si la red funciona, descarga el archivo nuevo, lo clona y lo guarda en la caché
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, resClone);
                });
                return response; // Entrega la versión fresca a la pantalla
            })
            .catch(() => {
                // Si el celular pierde internet (o el servidor cae), saca la copia de seguridad de la caché
                return caches.match(e.request);
            })
    );
});

// ══════════════════════════════════════════════════
//  SERVICE WORKER – Cultos de Barrios IPUC Vista Hermosa
//  Cachea el "cascarón" de la app (HTML/CSS/JS/íconos)
//  para que abra rápido y funcione (al menos para ver
//  el último estado) sin conexión.
// ══════════════════════════════════════════════════

const CACHE_NAME = "ipuc-cultos-v3";

// Archivos propios de la app que sí cacheamos
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-193.png",
  "./icon-513.png"
];

// ── INSTALL: precachear el app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar versiones viejas del caché ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estrategia según el tipo de recurso ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejamos peticiones GET
  if (request.method !== "GET") return;

  // Firebase (datos en vivo): siempre ir a la red, nunca caché.
  // Si falla por estar offline, dejamos que falle (la app ya
  // maneja la ausencia de datos mostrando 0 en las stats).
  if (url.hostname.includes("firebaseio.com") || url.hostname.includes("firebasedatabase.app")) {
    event.respondWith(fetch(request));
    return;
  }

  // Recursos propios del app shell: "cache first" con
  // actualización en segundo plano (stale-while-revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Recursos externos (tiles de mapa, fuentes, Leaflet, Firebase SDK):
  // intentar red primero, y si falla usar caché si existe.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

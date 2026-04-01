self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Cache static assets only — API calls always go to network
self.addEventListener('fetch', (event) => {
  // Never cache API calls
  if (event.request.url.includes('/api/')) return;

  // For everything else, try network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open('di-static-v1').then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

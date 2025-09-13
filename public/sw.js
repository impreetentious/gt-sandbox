/*
 * V2-P9 — the offline cache.
 *
 * Scope is deliberately tiny. This worker does not push, does not sync, does
 * not talk to anything, and never sees a request the browser was not already
 * making. It answers same-origin GETs from a cache and refreshes that cache in
 * the background; every other request falls through untouched. The origin guard
 * below is the I4 boundary written into the one place in the product that could
 * plausibly violate it.
 *
 * Cache naming comes from the `?v=` on the registration URL, which the app fills
 * in from `package.json`. Changing the version changes the script URL, so the
 * browser installs a fresh worker, `activate` drops every cache that is not the
 * current one, and a release cannot leave a reader pinned to stale chunks. No
 * clock is involved — the invalidation key is the version, not a timestamp.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `gts-${VERSION}`;

/*
 * Only the entry point and the offline notice are precached. Everything else
 * arrives through ordinary use, which keeps the install cheap and avoids
 * pretending to know the hashed asset names — those are decided by the build,
 * not by this file.
 */
const SHELL = ["/", "/offline/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  // I4, enforced rather than assumed: anything not on this origin is none of
  // this worker's business and is left to the network exactly as it was.
  if (new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/**
 * Answer from cache when there is one, and refresh it in the background.
 *
 * Cache-first alone would strand a reader on an old build; network-first would
 * make every navigation wait for a round trip that a static site does not need.
 * Stale-while-revalidate gets the instant paint and still converges on the
 * current deployment by the next visit.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const fresh = await network;

  if (fresh) {
    return fresh;
  }

  // Offline, and this exact document was never visited. Serving the cached
  // entry point here would be the usual app-shell trick and would also be a
  // small lie — the address bar would name a route the reader is not looking
  // at. The offline notice says what actually happened instead.
  if (request.mode === "navigate") {
    const notice = await cache.match("/offline/");

    if (notice) {
      return notice;
    }
  }

  return Response.error();
}

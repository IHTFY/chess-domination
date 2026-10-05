// Stamped by `pnpm sw:stamp` from the contents of every precached file, so any
// change to the app changes this file byte-for-byte and browsers install an update.
const VERSION = '62902a0eaf88';
const CACHE_PREFIX = `chess-domination-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

const FILES_TO_CACHE = [
  './scripts/chessboard-element.bundled.js',
  './scripts/findIssues.js',
  './scripts/highlighter.js',
  './scripts/main.js',
  './scripts/pwa.js',
  './scripts/solver.js',
  './scripts/utils.js',
  './scripts/storage.js',
  './manifest.json',
  './favicons/icon.svg',
  './favicons/favicon.ico',
  './favicons/browserconfig.xml',
  './favicons/maskable-192x192.png',
  './favicons/maskable-512x512.png',
  './favicons/apple-touch-icon.png',
  './favicons/favicon-16x16.png',
  './favicons/favicon-32x32.png',
  './favicons/android-chrome-192x192.png',
  './favicons/android-chrome-512x512.png',
  './favicons/mstile-150x150.png',
  './favicons/large.png',
  './sounds/beeps.mp3',
  './sounds/click1.mp3',
  './sounds/click2.mp3',
  './sounds/click3.mp3',
  './sounds/click4.mp3',
  './sounds/click5.mp3',
  './sounds/click6.mp3',
  './sounds/click7.mp3',
  './style/global.css',
  './svg/bB.svg',
  './svg/bK.svg',
  './svg/bN.svg',
  './svg/bP.svg',
  './svg/bQ.svg',
  './svg/bR.svg',
  './svg/wB.svg',
  './svg/wK.svg',
  './svg/wN.svg',
  './svg/wP.svg',
  './svg/wQ.svg',
  './svg/wR.svg',
  './index.html'
];

const assetURLs = new Set(FILES_TO_CACHE.map(path => new URL(path, self.registration.scope).href));
const indexURL = new URL('./index.html', self.registration.scope).href;
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  // No skipWaiting here: the page decides when the new version takes over, so an
  // update never swaps files out from under a game in progress.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Bypass the HTTP cache so a new version never precaches stale files.
    await cache.addAll(FILES_TO_CACHE.map(path => new Request(path, { cache: 'reload' })));
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});

// Network first with a short timeout so a flaky connection falls back to the
// cached shell quickly instead of hanging; fresh HTML wins whenever it is reachable.
async function handleNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = () => cache.match(indexURL);
  const network = (async () => {
    const response = await (event.preloadResponse || fetch(event.request));
    if (!response || !response.ok) throw new Error('bad navigation response');
    return response;
  })();
  const timeout = new Promise((_, reject) => setTimeout(reject, NAVIGATION_TIMEOUT_MS, new Error('timeout')));
  try {
    return await Promise.race([network, timeout]);
  } catch {
    network.catch(() => {});
    return (await cached()) || network;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(handleNavigation(event));
    return;
  }
  // Versioned precache: files only change together with a new service worker.
  const assetURL = new URL(url.pathname, url.origin).href;
  if (assetURLs.has(assetURL)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(assetURL) || fetch(event.request);
    })());
  }
});

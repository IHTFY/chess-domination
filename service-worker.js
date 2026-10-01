// Bump the version whenever a precached file changes.
const CACHE_PREFIX = `chess-domination-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v2`;

const FILES_TO_CACHE = [
  './scripts/chessboard-element.bundled.js',
  './scripts/findIssues.js',
  './scripts/highlighter.js',
  './scripts/main.js',
  './scripts/solver.js',
  './scripts/utils.js',
  './scripts/storage.js',
  './manifest.json',
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
  './style/icons/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
  './style/icons/materialIcons.css',
  './style/global.css',
  './style/materialize.min.css',
  './style/materialize.min.js',
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

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(FILES_TO_CACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(indexURL);
    }));
  } else if (assetURLs.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(event.request) || fetch(event.request);
    })());
  }
});

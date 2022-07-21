'use strict';

// Update cache names any time any of the cached files change.
const CACHE_NAME = 'static-cache-v1';

// Add list of files to cache here.
const FILES_TO_CACHE = [
  '/scripts/chessboard-element.bundled.js',
  '/scripts/isValid.js',
  '/scripts/main.js',
  '/scripts/solver.js',
  '/scripts/utils.js',
  '/sounds/beeps.mp3',
  '/sounds/click1.mp3',
  '/sounds/click2.mp3',
  '/sounds/click3.mp3',
  '/sounds/click4.mp3',
  '/sounds/click5.mp3',
  '/sounds/click6.mp3',
  '/sounds/click7.mp3',
  '/style/icons/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
  '/style/icons/materialIcons.css',
  '/style/global.css',
  '/style/materialize.min.css',
  '/style/materialize.min.js',
  '/svg/bB.svg',
  '/svg/bK.svg',
  '/svg/bN.svg',
  '/svg/bP.svg',
  '/svg/bQ.svg',
  '/svg/bR.svg',
  '/svg/wB.svg',
  '/svg/wK.svg',
  '/svg/wN.svg',
  '/svg/wP.svg',
  '/svg/wQ.svg',
  '/svg/wR.svg',
  '/index.html'
];

self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');

  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  // Remove previous cached data from disk.
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  console.log('[ServiceWorker] Fetch', evt.request.url);
  // Add fetch event handler here.
  if (evt.request.mode !== 'navigate') {
    // Not a page navigation, bail.
    return;
  }
  evt.respondWith(
    fetch(evt.request)
      .catch(() => {
        return caches.open(CACHE_NAME)
          .then((cache) => {
            return cache.match('index.html');
          });
      })
  );
});
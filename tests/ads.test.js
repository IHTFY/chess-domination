import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let added;
let online;
let shown;
let stored;
const box = { isConnected: true };

// The ad code lives in main.js between markers; a fresh copy per test starts without a loader request.
const adsSource = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8')
  .match(/\/\/ ads:start\n([\s\S]*?)\/\/ ads:end/)[1];
const loadAds = async () => new Function(`${adsSource}\nreturn { showAd, loadForBuyer };`)();
const tick = () => new Promise(resolve => setTimeout(resolve));

beforeEach(() => {
  added = [];
  shown = [];
  stored = new Map();
  online = true;
  // Record script tags instead of fetching them.
  globalThis.document = {
    createElement: () => {
      const listeners = {};
      return {
        addEventListener: (name, fn) => { listeners[name] = fn; },
        fire: name => listeners[name](),
        remove() {},
      };
    },
    head: { appendChild: el => added.push(el) },
    cookie: '',
  };
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ onLine: online }) });
  globalThis.window = { ihtfyAds: { show: (box, key) => shown.push([box, key]) } };
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.navigator;
});

test('loads the shared loader once, then hands it each box', async () => {
  const { showAd } = await loadAds();
  showAd(box, 'a');
  showAd(box, 'b');
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://ihtfy.com/ads/v1.js');
  added[0].fire('load');
  await tick();
  assert.deepEqual(shown, [[box, 'a'], [box, 'b']]);
});

test('skips a box that left the page before the loader arrived', async () => {
  const { showAd } = await loadAds();
  const gone = { isConnected: true };
  const back = { isConnected: true };
  showAd(gone, 'a');
  gone.isConnected = false;
  showAd(back, 'a');
  added[0].fire('load');
  await tick();
  assert.deepEqual(shown, [[back, 'a']]);
});

test('loads nothing offline', async () => {
  online = false;
  const { showAd } = await loadAds();
  showAd(box, 'a');
  assert.equal(added.length, 0);
});

test('stays quiet when the loader fails, and tries again on the next game over', async () => {
  const { showAd } = await loadAds();
  showAd(box, 'a');
  added[0].fire('error');
  await tick();
  assert.deepEqual(shown, []);
  showAd(box, 'b');
  assert.equal(added.length, 2);
});

test('loadForBuyer loads nothing for a visitor without an ad-free token', async () => {
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 0);
});

test('loadForBuyer loads the loader at startup when localStorage holds a token', async () => {
  stored.set('ihtfy-ad-free', 'token');
  const { loadForBuyer, showAd } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://ihtfy.com/ads/v1.js');
  showAd(box, 'a');
  assert.equal(added.length, 1);
});

test('loadForBuyer loads the loader at startup when only the cookie holds a token', async () => {
  document.cookie = 'a=b; ihtfy-ad-free=token';
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
});

test('loadForBuyer does nothing when storage and cookies cannot be read', async () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); } };
  Object.defineProperty(document, 'cookie', { get: () => { throw new Error('blocked'); } });
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 0);
});

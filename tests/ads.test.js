import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let added;
let online;
let shown;
let stored;
let listeners;
let railSize;
const box = { isConnected: true };

// The ad code lives in main.js between markers; a fresh copy per test starts without a loader request.
const adsSource = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8')
  .match(/\/\/ ads:start\n([\s\S]*?)\/\/ ads:end/)[1];
const loadAds = async () => new Function(`${adsSource}\nreturn { showAd, loadForBuyer, startPlayAd, newPlayAd, setUpPlayAd, showScreenAd, clearScreenAd };`)();
const tick = () => new Promise(resolve => setTimeout(resolve));

beforeEach(() => {
  added = [];
  shown = [];
  stored = new Map();
  online = true;
  listeners = {};
  railSize = [160, 600];
  globalThis.addEventListener = (type, fn) => (listeners[type] ??= []).push(fn);
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
    // The page's head script sets this class for a browser that may hold a token.
    documentElement: { classList: Object.assign(new Set(['ad-free']), {
      contains(name) { return this.has(name); },
      remove(name) { this.delete(name); },
      toggle(name, force) { if (force) this.add(name); else this.delete(name); },
    }) },
    cookie: '',
  };
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ onLine: online }) });
  globalThis.window = { ihtfyAds: { show: (box, key) => shown.push([box, key]) } };
});

afterEach(() => {
  mock.restoreAll();
  delete globalThis.addEventListener;
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

test('loadForBuyer still finds the cookie when storage cannot be read', async () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); } };
  document.cookie = 'ihtfy-ad-free=token';
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
});

// A box beside the board, as wide and tall as the stylesheet makes it in the current window.
function railBox() {
  const rail = {
    isConnected: true,
    dataset: {},
    get offsetWidth() { return railSize[0]; },
    get offsetHeight() { return railSize[1]; },
    cloneNode: () => Object.assign(railBox(), { dataset: { ...rail.dataset } }),
    replaceWith(next) { rail.isConnected = false; rail.next = next; },
  };
  return rail;
}
const fire = type => listeners[type]?.forEach(fn => fn());
const shownKeys = () => shown.map(([shownBox, key]) => [shownBox.dataset.adSize, key]);

test('the ad beside the board waits for the first tap or key press', async () => {
  const { startPlayAd } = await loadAds();
  const rail = railBox();
  startPlayAd(rail);
  await tick();
  assert.equal(added.length, 0);
  fire('pointerdown');
  await tick();
  assert.equal(added.length, 1);
  added[0].fire('load');
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1']]);
  assert.equal(shown[0][0], rail.next);
  assert.equal(rail.next.dataset.adSlot, '7239875855');
});

test('a window too small for the ad beside the board loads nothing', async () => {
  railSize = [0, 0];
  const { startPlayAd } = await loadAds();
  startPlayAd(railBox());
  fire('keydown');
  await tick();
  assert.equal(added.length, 0);
});

test('a new game replaces the ad beside the board only after a minute', async () => {
  let now = 1_000_000;
  mock.method(Date, 'now', () => now);
  const { startPlayAd, newPlayAd } = await loadAds();
  const rail = railBox();
  startPlayAd(rail);
  fire('pointerdown');
  await tick();
  added[0].fire('load');
  await tick();
  now += 59_000;
  newPlayAd();
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1']]);
  now += 1_000;
  newPlayAd();
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1'], ['160x600', 'play/2']]);
  assert.notEqual(shown[1][0], shown[0][0]);
});

test('crossing into another ad size gets a new ad; resizing within one does not', async () => {
  const { startPlayAd } = await loadAds();
  startPlayAd(railBox());
  fire('pointerdown');
  await tick();
  added[0].fire('load');
  await tick();
  fire('resize');
  railSize = [300, 600];
  fire('resize');
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1'], ['300x600', 'play/2']]);
  railSize = [0, 0];
  fire('resize');
  await tick();
  assert.equal(shown.length, 2);
  assert.equal(shown[1][0].isConnected, false);
});

test('the minute for the ad beside the board starts when it is placed, not when the loader is asked', async () => {
  let now = 1_000_000;
  mock.method(Date, 'now', () => now);
  const { startPlayAd, newPlayAd } = await loadAds();
  startPlayAd(railBox());
  fire('pointerdown');
  await tick();
  // A slow connection: the loader arrives a minute and a half after the request.
  now += 90_000;
  added[0].fire('load');
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1']]);
  now += 30_000;
  newPlayAd();
  await tick();
  assert.equal(shown.length, 1);
  now += 30_000;
  newPlayAd();
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1'], ['160x600', 'play/2']]);
});

test('a new game keeps waiting while the ad beside the board is still being placed', async () => {
  let now = 1_000_000;
  mock.method(Date, 'now', () => now);
  const { startPlayAd, newPlayAd } = await loadAds();
  startPlayAd(railBox());
  fire('pointerdown');
  await tick();
  now += 120_000;
  newPlayAd();
  await tick();
  assert.equal(added.length, 1);
  added[0].fire('load');
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/1']]);
});

test('a failed request lets the next game ask again at once', async () => {
  const { startPlayAd, newPlayAd } = await loadAds();
  startPlayAd(railBox());
  fire('pointerdown');
  await tick();
  added[0].fire('error');
  await tick();
  newPlayAd();
  await tick();
  assert.equal(added.length, 2);
  added[1].fire('load');
  await tick();
  assert.deepEqual(shownKeys(), [['160x600', 'play/2']]);
});

// A screen holding one `.ad-box`, sized by the stylesheet as `railSize` says.
function screen() {
  const element = { box: railBox() };
  element.querySelector = selector => selector === '.ad-box' ? element.box : null;
  const { cloneNode } = element.box;
  const track = box => {
    box.cloneNode = (...args) => track(cloneNode.apply(box, args));
    box.replaceWith = next => { box.isConnected = false; element.box = next; };
    return box;
  };
  track(element.box);
  return element;
}

test('the results screen gets a new, sized box for each game over', async () => {
  document.documentElement.classList.delete('ad-free');
  railSize = [300, 250];
  const { showScreenAd } = await loadAds();
  const results = screen();
  const first = results.box;
  showScreenAd('results', results, 'a');
  assert.notEqual(results.box, first);
  assert.equal(first.isConnected, false);
  assert.equal(results.box.dataset.adSize, '300x250');
  added[0].fire('load');
  await tick();
  assert.deepEqual(shown, [[results.box, 'a']]);
  const second = results.box;
  showScreenAd('results', results, 'b');
  assert.notEqual(results.box, second);
  await tick();
  assert.deepEqual(shown.map(([, key]) => key), ['a', 'b']);
});

test('the shorter sizes are asked for as the stylesheet sets them', async () => {
  document.documentElement.classList.delete('ad-free');
  const { showScreenAd } = await loadAds();
  for (const size of [[320, 100], [320, 50]]) {
    railSize = size;
    const results = screen();
    showScreenAd('results', results, size.join('x'));
    assert.equal(results.box.dataset.adSize, size.join('x'));
  }
});

test('the play screen and the dialogs never get a box', async () => {
  document.documentElement.classList.delete('ad-free');
  railSize = [300, 250];
  const { showScreenAd } = await loadAds();
  for (const name of ['play', 'scores', 'instructions', 'home']) {
    const other = screen();
    const box = other.box;
    showScreenAd(name, other, name);
    assert.equal(other.box, box, name);
  }
  assert.equal(added.length, 0);
  assert.deepEqual(shown, []);
});

test('a visitor who may have bought ad-free never gets a box on the results screen', async () => {
  railSize = [300, 250];
  assert.equal(document.documentElement.classList.has('ad-free'), true);
  const { showScreenAd } = await loadAds();
  const results = screen();
  const box = results.box;
  showScreenAd('results', results, 'a');
  assert.equal(results.box, box);
  assert.equal(added.length, 0);
  assert.deepEqual(shown, []);
});

test('a results screen without room for its box asks for no ad', async () => {
  document.documentElement.classList.delete('ad-free');
  railSize = [0, 0];
  const { showScreenAd } = await loadAds();
  showScreenAd('results', screen(), 'a');
  assert.equal(added.length, 0);
});

test('leaving the results screen swaps its box for an empty one', async () => {
  document.documentElement.classList.delete('ad-free');
  railSize = [300, 250];
  const { showScreenAd, clearScreenAd } = await loadAds();
  const results = screen();
  showScreenAd('results', results, 'a');
  const filled = results.box;
  clearScreenAd(results);
  assert.notEqual(results.box, filled);
  assert.equal(filled.isConnected, false);
  added[0].fire('load');
  await tick();
  assert.deepEqual(shown, []);
});

// The aside beside the board, holding a box.
function rail() {
  const aside = { box: railBox(), querySelector: () => aside.box };
  return aside;
}

async function setUpForToken(valid) {
  stored.set('ihtfy-ad-free', 'token');
  window.ihtfyAds.adFree = async () => valid;
  const { setUpPlayAd } = await loadAds();
  setUpPlayAd(rail());
  added[0].fire('load');
  await tick();
  fire('pointerdown');
  await tick();
}

test('a buyer gets no box beside the board', async () => {
  await setUpForToken(true);
  assert.equal(document.documentElement.classList.has('ad-free'), true);
  assert.deepEqual(shown, []);
});

test('the box beside the board comes back when the token is not valid', async () => {
  await setUpForToken(false);
  assert.equal(document.documentElement.classList.has('ad-free'), false);
  assert.deepEqual(shownKeys(), [['160x600', 'play/1']]);
});

test('the head script\'s class follows the token as main.js finds it', async () => {
  const { setUpPlayAd } = await loadAds();
  setUpPlayAd(rail());
  assert.equal(document.documentElement.classList.has('ad-free'), false);
  stored.set('ihtfy-ad-free', 'token');
  setUpPlayAd(rail());
  assert.equal(document.documentElement.classList.has('ad-free'), true);
});

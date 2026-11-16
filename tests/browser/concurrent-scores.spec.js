import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('simultaneous score writes from two tabs preserve both records', async ({ context, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  const first = await context.newPage();
  const second = await context.newPage();
  for (const page of [first, second]) {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#board')?.sparePieces && localStorage.getItem('scores'));
  }
  // Pause the first renderer after its storage read and before its storage write.
  // The second renderer can continue, as it can in a real two-tab race.
  const source = readFileSync(new URL('../../scripts/main.js', import.meta.url), 'utf8');
  const lineNumber = source.split('\n').findIndex(line => line.includes("writeStored('scores', JSON.stringify(scores))"));
  expect(lineNumber).toBeGreaterThan(0);
  const debuggerSession = await context.newCDPSession(first);
  await debuggerSession.send('Debugger.enable');
  const { breakpointId } = await debuggerSession.send('Debugger.setBreakpointByUrl', {
    url: `${baseURL}/scripts/main.js`, lineNumber,
  });
  const paused = new Promise(resolve => debuggerSession.once('Debugger.paused', resolve));
  const placingFirst = first.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wQ' }, false));
  await paused;
  try {
    await second.evaluate(() => {
      document.querySelector('#board').shadowRoot.querySelector('#spare-wN').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      document.querySelector('#board').setPosition({ a1: 'wN', a2: 'wN' }, false);
    });
    expect(await second.locator('#board').evaluate(board => board.position)).toEqual({ a1: 'wN', a2: 'wN' });
  } finally {
    await debuggerSession.send('Debugger.removeBreakpoint', { breakpointId });
    await debuggerSession.send('Debugger.resume');
    await placingFirst;
  }
  await expect.poll(async () => {
    const saved = await second.evaluate(() => JSON.parse(localStorage.getItem('scores')));
    return { queen: saved.MAX.Q.pb, knight: saved.MAX.N.pb };
  }, { message: 'The first tab overwrote the second tab\'s saved knight record' }).toEqual({ queen: 1, knight: 2 });
});

for (const resetFirst of [false, true]) {
  test(`a queued reset ${resetFirst ? 'before' : 'after'} a save clears older records`, async ({ context, baseURL }) => {
    await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    const first = await context.newPage();
    const second = await context.newPage();
    for (const page of [first, second]) {
      await page.goto('/');
      await page.waitForFunction(() => document.querySelector('#board')?.sparePieces && localStorage.getItem('scores'));
    }
    await first.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wQ' }, false));
    await expect.poll(() => first.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(1);
    await first.click('#statsBtn');
    await first.click('#resetBtn');
    // Hold the real shared lock so both operations are queued in a known order.
    await first.evaluate(() => {
      window.scoreLock = navigator.locks.request('chess-domination-scores', () => new Promise(resolve => {
        window.releaseScoreLock = resolve;
      }));
    });
    await first.waitForFunction(() => window.releaseScoreLock);
    const reset = () => first.click('#confirmReset');
    const save = () => second.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wR' }, false));
    await (resetFirst ? reset() : save());
    await expect.poll(() => first.evaluate(async () => (await navigator.locks.query()).pending.length)).toBe(1);
    await (resetFirst ? save() : reset());
    await expect.poll(() => first.evaluate(async () => (await navigator.locks.query()).pending.length)).toBe(2);
    await first.evaluate(() => window.releaseScoreLock());
    await expect.poll(() => second.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('scores'));
      return { queen: saved.MAX.Q.pb, rook: saved.MAX.R.pb };
    })).toEqual({ queen: 0, rook: resetFirst ? 1 : 0 });
    await second.click('#statsBtn');
    await expect(second.locator('#queenBest')).toHaveText('–');
    await expect(second.locator('#rookBest')).toHaveText(resetFirst ? '1' : '–');
  });
}

for (const locks of ['unavailable', 'blocked']) {
  test(`scores still save and reset when the lock API is ${locks}`, async ({ page, context, baseURL }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    await page.addInitScript(locks => Object.defineProperty(navigator, 'locks', {
      value: locks === 'unavailable' ? undefined : {
        request: () => Promise.reject(new DOMException('Storage blocked', 'SecurityError')),
      },
    }), locks);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#board')?.sparePieces && localStorage.getItem('scores'));
    await page.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wQ' }, false));
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(1);
    await page.click('#statsBtn');
    await page.click('#resetBtn');
    await page.click('#confirmReset');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('a failed write keeps the in-session best when pieces are removed', async ({ page, context, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.sparePieces && localStorage.getItem('scores'));
  await page.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wQ' }, false));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(1);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'scores') throw new DOMException('Storage full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
    document.querySelector('#board').setPosition({ a1: 'wQ', b3: 'wQ', c5: 'wQ' }, false);
  });
  await expect(page.locator('#queenBest')).toHaveText('3');
  await page.evaluate(async () => {
    document.querySelector('#board').setPosition({ a1: 'wQ', b3: 'wQ' }, false);
    await navigator.locks.request('chess-domination-scores', () => {});
  });
  await expect(page.locator('#queenBest')).toHaveText('3');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(1);
});

test('an inactive document lock rejection still saves the best without an unhandled error', async ({ page, context, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.sparePieces && localStorage.getItem('scores'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'locks', {
      value: { request: () => Promise.reject(new DOMException('Document inactive', 'InvalidStateError')) },
    });
    document.querySelector('#board').setPosition({ a1: 'wQ', b3: 'wQ', c5: 'wQ' }, false);
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(3);
  expect(errors).toEqual([]);
});

test('an error inside a locked change is reported without running the change again', async ({ page, context, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { withScoresLock } = await import('/scripts/storage.js');
    let calls = 0;
    try {
      await withScoresLock(() => {
        calls++;
        throw new DOMException('Change failed', 'SecurityError');
      });
    } catch (error) {
      return { calls, name: error.name, message: error.message };
    }
  });
  expect(result).toEqual({ calls: 1, name: 'SecurityError', message: 'Change failed' });
});

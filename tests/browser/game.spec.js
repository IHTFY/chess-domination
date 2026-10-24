import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.draggablePieces);
}

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
});

test('solve, clear, mode, record persistence and reset work without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Exercise rejected playback, including restoring the reset animation duration.
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error('Playback blocked'));
  });
  await ready(page);
  await page.getByRole('button', { name: 'Place queen', exact: true }).click();
  await page.click('#exampleBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(8);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MAX.Q.pb)).toBe(8);
  await page.reload();
  await page.click('#statsBtn');
  await expect(page.locator('#queenBest')).toHaveText('8');
  await page.keyboard.press('Escape');
  await page.click('#dominationBtn');
  await expect(page.locator('#dominationBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Place queen', exact: true }).click();
  await page.click('#exampleBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(5);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MIN.Q.pb)).toBe(5);
  await page.click('#clearBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(0);
  await page.click('#statsBtn');
  await page.click('#resetBtn');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scores')).MIN.Q.pb)).toBe(64);
  await expect(page.locator('#statsPanel')).not.toHaveClass(/scores-resetting/);
  expect(errors).toEqual([]);
});

test('corrupted storage and blocked storage still allow solving', async ({ browser }) => {
  for (const blocked of [false, true]) {
    const context = await browser.newContext();
    await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
    await context.addInitScript(blocked => {
      if (blocked) {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } });
      } else {
        localStorage.setItem('scores', '{');
        localStorage.setItem('gameMode', 'invalid');
        localStorage.setItem('soundMode', 'not JSON');
        localStorage.setItem('hilight', 'null');
      }
    }, blocked);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await ready(page);
    await page.getByRole('button', { name: 'Place rook', exact: true }).click();
    await page.click('#exampleBtn');
    await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(8);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('all solvers produce optimal valid positions with deterministic randomness', async ({ page }) => {
  await ready(page);
  const failures = await page.evaluate(async () => {
    const { solve } = await import('/scripts/solver.js');
    const { findIssues } = await import('/scripts/findIssues.js');
    const { fenToObj } = await import('/scripts/chessboard-element.bundled.js');
    const expected = { MAX: [16, 8, 8, 14, 32, 32], MIN: [9, 5, 8, 8, 12, 32] };
    const pieces = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
    const failures = [];
    const original = Math.random;
    let seed = 42;
    Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
    try {
      for (const mode of ['MAX', 'MIN']) {
        for (const [index, piece] of pieces.entries()) {
          for (let i = 0; i < 500; i++) {
            let position = solve(piece, mode);
            if (typeof position === 'string') position = fenToObj(position);
            if (Object.keys(position).length !== expected[mode][index] || findIssues(position, mode).length) {
              failures.push({ mode, piece, position });
              break;
            }
          }
        }
      }
    } finally {
      Math.random = original;
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test('validator handles knight moves, pawn direction, mixed pieces and empty boards', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { findIssues } = await import('/scripts/findIssues.js');
    return {
      knight: findIssues({ a1: 'wN', b3: 'wN' }, 'MAX').sort(),
      knightSafe: findIssues({ a1: 'wN', b2: 'wN' }, 'MAX'),
      pawn: findIssues({ b2: 'wP', a1: 'wP' }, 'MAX'),
      pawnSafe: findIssues({ a1: 'wP', a2: 'wP' }, 'MAX'),
      mixed: findIssues({ a1: 'wQ', b3: 'wQ', c5: 'wN' }, 'MAX'),
      emptyMax: findIssues({}, 'MAX').length,
      emptyMin: findIssues({}, 'MIN').length,
    };
  });
  expect(result).toEqual({ knight: ['a1', 'b3'], knightSafe: [], pawn: ['a1'], pawnSafe: [], mixed: ['c5'], emptyMax: 0, emptyMin: 64 });
});

test('offline reload serves the game and activation preserves unrelated caches', async ({ page, context }) => {
  // Seed caches before first registration so activation must clean up only its own.
  await page.goto('/README.md');
  await page.evaluate(async () => {
    const scope = `${location.origin}/`;
    await caches.open('another-app-cache');
    await caches.open(`chess-domination-${scope}-v1`);
  });
  await ready(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  expect(await page.evaluate(() => caches.keys())).toContain('another-app-cache');
  expect(await page.evaluate(() => caches.keys())).not.toContain('chess-domination-http://127.0.0.1:8765/-v1');
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#board')?.draggablePieces);
  await page.getByRole('button', { name: 'Place queen', exact: true }).click();
  await page.click('#exampleBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(8);
  expect(await page.evaluate(async () => {
    const urls = ['scripts/storage.js', 'style/global.css', 'svg/wQ.svg', 'sounds/beeps.mp3', 'manifest.json'];
    return Promise.all(urls.map(async url => (await fetch(url)).ok));
  })).toEqual([true, true, true, true, true]);
});

test('mode switch remains clickable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ready(page);
  await page.click('#dominationBtn');
  await expect(page.locator('#dominationBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Place queen', exact: true }).click();
  await page.click('#exampleBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector('#board').position).length)).toBe(5);
});

const viewports = [
  [320, 568], [375, 667], [390, 844], [768, 1024], // portrait
  [568, 320], [667, 375], [844, 390], [1024, 768], // landscape
  [1366, 768], [1920, 1080], [2560, 1080], // desktop
];
for (const [width, height] of viewports) {
  test(`layout fits ${width}x${height} without scrolling or overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.getByRole('button', { name: 'Place queen', exact: true }).click();
    await page.click('#exampleBtn');
    const layout = await page.evaluate(() => {
      const rect = (el, selector) => {
        const r = el.getBoundingClientRect();
        return r.width && r.height ? { selector, left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
      };
      const content = ['#topbar', '#board', '#options', '#statsPanel']
        .map(selector => rect(document.querySelector(selector), selector)).filter(Boolean);
      const controls = [...document.querySelectorAll('#topbar > *, #options button'), ...document.querySelector('#board').shadowRoot.querySelectorAll('[id^="spare-w"]')]
        .map(el => rect(el, el.id || el.className)).filter(Boolean);
      return {
        scroll: [document.scrollingElement.scrollWidth, document.scrollingElement.scrollHeight],
        content,
        controls,
      };
    });
    expect(layout.scroll).toEqual([width, height]);
    const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= width + 0.5 && r.bottom <= height + 0.5;
    expect(layout.content.filter(r => !inside(r))).toEqual([]);
    expect(layout.controls.filter(r => !inside(r))).toEqual([]);
    const overlaps = [];
    layout.content.forEach((a, i) => layout.content.slice(i + 1).forEach(b => {
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) {
        overlaps.push([a.selector, b.selector]);
      }
    }));
    expect(overlaps).toEqual([]);
    expect(layout.content.map(r => r.selector)).toContain('#options');
  });
}

test('scores open in a dismissible popup on short screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await ready(page);
  await expect(page.locator('#statsPanel')).toBeHidden();
  await page.click('#statsBtn');
  await expect(page.locator('#statsPanel')).toBeVisible();
  await page.click('#resetBtn');
  await page.keyboard.press('Escape');
  await expect(page.locator('#statsPanel')).toBeHidden();
  await page.click('#statsBtn');
  await page.click('#statsClose');
  await expect(page.locator('#statsPanel')).toBeHidden();
});

const eightQueens = { a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ', h4: 'wQ' };

test('a solved board opens the results screen once per solve; examples and first load request no ad', async ({ page }) => {
  const loads = [];
  await page.route('https://ihtfy.com/ads/v1.js', route => {
    loads.push(route.request().url());
    route.fulfill({ contentType: 'text/javascript', body: 'window.ihtfyAds = { show: (box, key) => (window.__shown ??= []).push(key) };' });
  });
  await ready(page);
  await page.waitForTimeout(600);
  expect(loads).toEqual([]);
  await page.click('#nonAttackingBtn');
  await page.click('#exampleBtn');
  await page.waitForTimeout(900);
  expect(loads).toEqual([]);
  await expect(page.locator('#solvedPanel')).toBeHidden();
  await page.click('#clearBtn');
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect(page.locator('#solvedPanel')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#solvedPanel').closest('dialog'))).toBeNull();
  await expect(page.locator('#solvedPanel .ad p')).toHaveText('Advertisements');
  await expect(page.locator('#solvedPanel .ad a')).toHaveAttribute('href', 'https://ihtfy.com/privacy/');
  await expect(page.locator('#adBox')).toHaveAttribute('data-ad-slot', '6470163205');
  await expect.poll(() => page.evaluate(() => window.__shown?.length)).toBe(1);
  expect(loads).toHaveLength(1);
  await expect(page.locator('#playAgainBtn')).toBeFocused();
  await expect(page.locator('.header-actions')).toHaveCSS('visibility', 'hidden');
  await page.keyboard.press('Escape');
  await expect(page.locator('#solvedPanel')).toBeHidden();
  await expect(page.locator('#adBox')).toBeEmpty();
  expect(await page.locator('#board').evaluate(board => board.position)).toEqual(eightQueens);
  await page.click('#clearBtn');
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect.poll(() => page.evaluate(() => window.__shown?.length)).toBe(2);
  await page.click('#playAgainBtn');
  await expect(page.locator('#solvedPanel')).toBeHidden();
  expect(await page.locator('#board').evaluate(board => board.position)).toEqual({});
});

// Each box as the loader fills it: a fixed-size unit of the size asked for.
const fillingLoader = 'window.ihtfyAds = { show(box) { const [w, h] = box.dataset.adSize.split("x"); const ad = document.createElement("ins"); ad.style.cssText = `display:inline-block;width:${w}px;height:${h}px`; box.append(ad); (window.__shown ??= []).push(box.dataset.adSize); } };';
const resultsCases = [[360, 640], [390, 750], [412, 800], [1280, 800], [375, 560], [360, 400]];
for (const [width, height] of resultsCases) {
  test(`at ${width}x${height} the results ad is in view, clear of every control, and does not shift the screen`, async ({ page }) => {
    await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: fillingLoader }));
    await page.setViewportSize({ width, height });
    await page.goto('/?adtest=on');
    await page.waitForFunction(() => document.querySelector('#board')?.sparePieces);
    await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
    await expect(page.locator('#solvedPanel')).toBeVisible();
    const measure = () => page.evaluate(() => {
      const rect = el => { const { left, top, right, bottom } = el.getBoundingClientRect(); return { left, top, right, bottom }; };
      const box = rect(document.querySelector('#adBox'));
      const controls = [...document.querySelectorAll('#app button, #app a')].filter(el => getComputedStyle(el).visibility !== 'hidden' && el.offsetParent);
      const gaps = controls.map(el => {
        const r = el.getBoundingClientRect();
        return Math.hypot(Math.max(0, r.left - box.right, box.left - r.right), Math.max(0, r.top - box.bottom, box.top - r.bottom));
      });
      const main = rect(document.querySelector('#playAgainBtn'));
      const text = rect(document.querySelector('#solved-title'));
      return { box, main, text, gaps, controls: controls.length, size: document.querySelector('#adBox').dataset.adSize, inView: [box, main, text].every(r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), scroll: [document.scrollingElement.scrollWidth, document.scrollingElement.scrollHeight] };
    });
    const before = await measure();
    await expect.poll(() => page.evaluate(() => window.__shown)).toEqual([before.size]);
    const after = await measure();
    expect(after).toEqual(before);
    expect(before.size).toBe(height >= 576 ? '300x250' : height >= 425 ? '320x100' : '320x50');
    expect(before.inView).toBe(true);
    expect(before.scroll).toEqual([width, height]);
    expect(before.controls).toBeGreaterThanOrEqual(3);
    for (const gap of before.gaps) expect(gap).toBeGreaterThanOrEqual(50);
  });
}

test('turning the phone while the results show keeps the box at the size of its ad', async ({ page }) => {
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: fillingLoader }));
  await page.setViewportSize({ width: 390, height: 750 });
  await ready(page);
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect.poll(() => page.evaluate(() => window.__shown)).toEqual(['300x250']);
  const size = () => page.locator('#adBox').evaluate(box => [box.offsetWidth, box.offsetHeight]);
  expect(await size()).toEqual([300, 250]);
  await page.setViewportSize({ width: 750, height: 390 });
  expect(await size()).toEqual([300, 250]);
  const gap = await page.evaluate(() => {
    const box = document.querySelector('#adBox').getBoundingClientRect();
    return document.querySelector('#solvedPanel .ad a').getBoundingClientRect().top - box.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(50);
  // The next visit sizes its box from the window again, not from the last ad.
  await page.click('#backBtn');
  await page.setViewportSize({ width: 390, height: 500 });
  await page.click('#clearBtn');
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect.poll(() => page.evaluate(() => window.__shown)).toEqual(['300x250', '320x100']);
  expect(await size()).toEqual([320, 100]);
});

test('the results ad is one box that a new solve replaces, and the play screen and dialogs have none', async ({ page }) => {
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: fillingLoader }));
  await page.setViewportSize({ width: 390, height: 750 });
  await ready(page);
  await page.click('#statsBtn');
  await page.keyboard.press('Escape');
  await page.click('#aboutBtn');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ad-slot]:visible')).toHaveCount(0);
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect(page.locator('#solvedPanel')).toBeVisible();
  await expect(page.locator('[data-ad-slot]:visible')).toHaveCount(1);
  await expect(page.locator('dialog [data-ad-slot]')).toHaveCount(0);
  await page.click('#backBtn');
  await expect(page.locator('#adBox')).toBeEmpty();
  await expect(page.locator('[data-ad-slot]:visible')).toHaveCount(0);
});

test('a buyer gets no results ad box and no space for one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ihtfy-ad-free', 'token'));
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.ihtfyAds = { adFree: async () => true, show() { window.__asked = true; } };` }));
  await page.setViewportSize({ width: 390, height: 750 });
  await ready(page);
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await expect(page.locator('#solvedPanel')).toBeVisible();
  await expect(page.locator('#solvedPanel .ad')).toBeHidden();
  expect(await page.locator('#adBox').evaluate(box => box.offsetHeight)).toBe(0);
  expect(await page.evaluate(() => window.__asked)).toBeUndefined();
});

const railCases = [
  [390, 844, ''], [1280, 800, ''], [1440, 900, ''], [1440, 850, '160x600'], [1440, 851, ''],
  [1366, 768, '160x600'], [1536, 864, '160x600'], [1920, 1080, '300x600'], [2560, 1080, '300x600'],
];
for (const [width, height, size] of railCases) {
  test(`at ${width}x${height} the ad beside the board is ${size || 'absent'} and the board keeps its size`, async ({ browser }) => {
    const boards = [];
    for (const buyer of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
      if (buyer) {
        await context.addInitScript(() => localStorage.setItem('ihtfy-ad-free', 'token'));
        await context.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.ihtfyAds = { adFree: async () => true, show() {} };' }));
      }
      const page = await context.newPage();
      await ready(page);
      if (buyer) await page.waitForFunction(() => window.ihtfyAds);
      const layout = await page.evaluate(() => {
        const board = document.querySelector('#board').getBoundingClientRect();
        const box = document.querySelector('#playAdBox');
        if (!box?.offsetWidth) return { board: [board.width, board.height], size: '' };
        const ad = box.getBoundingClientRect();
        const controls = [...document.querySelectorAll('#app button, #app a, #board'), ...document.querySelector('#board').shadowRoot.querySelectorAll('[id^="spare-w"]')];
        const gap = Math.min(...controls.map(el => {
          const r = el.getBoundingClientRect();
          return Math.hypot(Math.max(0, r.left - ad.right, ad.left - r.right), Math.max(0, r.top - ad.bottom, ad.top - r.bottom));
        }));
        return { board: [board.width, board.height], size: `${ad.width}x${ad.height}`, gap, inside: ad.right <= innerWidth && ad.bottom <= innerHeight && ad.top >= 0 };
      });
      layout.scroll = await page.evaluate(() => [document.scrollingElement.scrollWidth, document.scrollingElement.scrollHeight]);
      expect(layout.scroll).toEqual([width, height]);
      if (buyer) {
        await expect(page.locator('#playAd')).toBeHidden();
      } else {
        expect(layout.size).toBe(size);
        if (size) {
          expect(layout.gap).toBeGreaterThanOrEqual(150);
          expect(layout.inside).toBe(true);
          await expect(page.locator('#playAd p')).toHaveText('Advertisements');
          await expect(page.locator('#playAd a')).toHaveAttribute('href', 'https://ihtfy.com/privacy/');
        }
      }
      boards.push(layout.board);
      await context.close();
    }
    expect(boards[1]).toEqual(boards[0]);
  });
}

test('a buyer never sees the ad rail or a board shift while the page script is slow', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('ihtfy-ad-free', 'token');
    // One sample per frame until the delayed script has run.
    window.__samples = [];
    const sample = () => {
      const rail = document.querySelector('#playAd');
      const app = document.querySelector('.app');
      if (rail && app) {
        const { left, width } = app.getBoundingClientRect();
        window.__samples.push({ rail: getComputedStyle(rail).display, left, width });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.route('**/scripts/main.js', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ response });
  });
  await ready(page);
  await page.waitForTimeout(300);
  const samples = await page.evaluate(() => window.__samples);
  expect(samples.length).toBeGreaterThan(30);
  expect(samples.filter(frame => frame.rail !== 'none')).toEqual([]);
  expect(new Set(samples.map(frame => `${frame.left},${frame.width}`)).size).toBe(1);
});

test('the ad beside the board loads only after the first tap, and dialogs stay 150px clear of it', async ({ page }) => {
  const loads = [];
  await page.route('https://ihtfy.com/ads/v1.js', route => {
    loads.push(route.request().url());
    route.fulfill({ contentType: 'text/javascript', body: 'window.ihtfyAds = { show: (box, key) => (window.__shown ??= []).push([box.dataset.adSize, key]) };' });
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  await page.waitForTimeout(600);
  expect(loads).toEqual([]);
  await page.locator('[data-square="e4"]').click();
  await expect.poll(() => page.evaluate(() => window.__shown)).toEqual([['160x600', 'play/1']]);
  const adLeft = await page.locator('#playAdBox').evaluate(box => box.getBoundingClientRect().left);
  for (const [button, dialog] of [['#statsBtn', '#statsPanel'], ['#aboutBtn', '#instructions']]) {
    await page.click(button);
    const right = await page.locator(dialog).evaluate(el => Math.max(el.getBoundingClientRect().right, innerWidth - parseFloat(getComputedStyle(el, '::backdrop').right)));
    expect(adLeft - right).toBeGreaterThanOrEqual(150);
    await page.keyboard.press('Escape');
  }
});

test('the ad beside the board comes back when the ad-free token is not valid, and the board keeps its size', async ({ page }) => {
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.ihtfyAds = { adFree: async () => false, show: (box, key) => (window.__shown ??= []).push([box.dataset.adSize, key]) };' }));
  await page.addInitScript(() => localStorage.setItem('ihtfy-ad-free', 'not-a-token'));
  await page.setViewportSize({ width: 1366, height: 768 });
  const boardWidth = () => page.locator('#board').evaluate(board => board.getBoundingClientRect().width);
  await ready(page);
  const before = await boardWidth();
  await expect(page.locator('#playAdBox')).toHaveCSS('width', '160px');
  expect(await boardWidth()).toBe(before);
  await page.locator('[data-square="e4"]').click();
  await expect.poll(() => page.evaluate(() => window.__shown)).toEqual([['160x600', 'play/1']]);
});

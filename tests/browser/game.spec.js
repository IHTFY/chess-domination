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

test('a solved board opens the ad dialog once per solve; examples and first load request no ad', async ({ page }) => {
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
  await expect(page.locator('#solvedPanel')).not.toBeVisible();
  await page.click('#clearBtn');
  await page.locator('#board').evaluate(board => board.setPosition({ a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ', h4: 'wQ' }, false));
  await expect(page.locator('#solvedPanel')).toBeVisible();
  await expect(page.locator('#solvedPanel .ad p')).toHaveText('Advertisements');
  await expect(page.locator('#adBox')).toHaveAttribute('data-ad-slot', '6470163205');
  await expect.poll(() => page.evaluate(() => window.__shown?.length)).toBe(1);
  expect(loads).toHaveLength(1);
  const gap = await page.evaluate(() => document.querySelector('#adBox').getBoundingClientRect().top - document.querySelector('#solvedPanel .close').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(150);
  await page.keyboard.press('Escape');
  await page.click('#clearBtn');
  await page.locator('#board').evaluate(board => board.setPosition({ a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ', h4: 'wQ' }, false));
  await expect.poll(() => page.evaluate(() => window.__shown?.length)).toBe(2);
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
      if (buyer) await context.addInitScript(() => localStorage.setItem('ihtfy-ad-free', 'token'));
      const page = await context.newPage();
      await ready(page);
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
        expect(await page.locator('#playAd').count()).toBe(0);
      } else {
        expect(layout.size).toBe(size);
        if (size) {
          expect(layout.gap).toBeGreaterThanOrEqual(150);
          expect(layout.inside).toBe(true);
          await expect(page.locator('#playAd p')).toHaveText('Advertisements');
          await expect(page.locator('#playAd a')).toHaveAttribute('href', 'https://ihtfy.com/privacy');
        }
      }
      boards.push(layout.board);
      await context.close();
    }
    expect(boards[1]).toEqual(boards[0]);
  });
}

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

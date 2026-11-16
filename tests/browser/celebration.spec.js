import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test.beforeEach(async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route(url => url.origin !== origin, route => route.abort());
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.ihtfyAds = { show: (_box, key) => (window.resultRequests ??= []).push(key) };',
  }));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.sparePieces);
  // Pause between actions as well as advancing timers, so machine load cannot change their order.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
});

test('quickly removing and replacing the final queen opens only one result ad', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('#board').setPosition({ a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ' }, false);
    document.querySelector('#board').shadowRoot.querySelector('[data-square="h4"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.clock.runFor(100);
  await page.evaluate(() => {
    const cell = document.querySelector('#board').shadowRoot.querySelector('[data-square="h4"]');
    for (let i = 0; i < 2; i++) cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.clock.runFor(401);
  // If an obsolete result opened, let its stubbed loader finish before the next timer.
  // A corrected implementation leaves the result hidden here.
  await expect.poll(() => page.evaluate(() => document.querySelector('#solvedPanel').hidden || window.resultRequests?.length > 0)).toBe(true);
  await page.clock.runFor(100);
  await expect.poll(() => page.evaluate(() => window.resultRequests?.length ?? 0)).toBeGreaterThan(0);
  await expect(page.locator('#solvedPanel')).toBeVisible();
  expect(await page.evaluate(() => window.resultRequests), 'A stale completion timer must not replace an ad on the same results visit').toHaveLength(1);
});

test('replacing a solved board cancels its pending result', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('#board').setPosition({ a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ', h4: 'wQ' }, false);
  });
  await page.clock.runFor(100);
  await page.evaluate(() => {
    document.querySelector('#clearBtn').click();
    document.querySelector('#board').shadowRoot.querySelector('#spare-wK').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const kings = {};
    for (const file of 'aceg') for (const rank of '1357') kings[file + rank] = 'wK';
    document.querySelector('#board').setPosition(kings, false);
  });
  // The new king board's result is due after the old queen board's result.
  await page.clock.runFor(401);
  const state = await page.evaluate(() => ({
    shown: !document.querySelector('#solvedPanel').hidden,
    message: document.querySelector('#solved-text').textContent,
    boardPieces: Object.values(document.querySelector('#board').position),
  }));
  expect(state.boardPieces).toEqual(Array(16).fill('wK'));
  expect(state, 'The old queen timer must not open a result claiming there are 8 kings').toEqual({
    shown: false,
    message: '',
    boardPieces: Array(16).fill('wK'),
  });
  await page.clock.runFor(100);
  await expect(page.locator('#solved-text')).toHaveText('16 kings and none attack another. That is the maximum.');
});

const eightQueens = { a1: 'wQ', b5: 'wQ', c8: 'wQ', d6: 'wQ', e3: 'wQ', f7: 'wQ', g2: 'wQ', h4: 'wQ' };

test('switching modes away and back starts a fresh completion delay', async ({ page }) => {
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await page.clock.runFor(100);
  await page.evaluate(() => {
    document.querySelector('#dominationBtn').click();
    document.querySelector('#nonAttackingBtn').click();
  });
  await page.clock.runFor(401);
  await expect(page.locator('#solvedPanel')).toBeHidden();
  expect(await page.evaluate(() => window.resultRequests ?? [])).toEqual([]);
  await page.clock.runFor(100);
  await expect(page.locator('#solved-text')).toHaveText('8 queens and none attack another. That is the maximum.');
  await expect.poll(() => page.evaluate(() => window.resultRequests?.length ?? 0)).toBe(1);
});

for (const button of ['clearBtn', 'exampleBtn']) {
  test(`${button} cancels a pending completion`, async ({ page }) => {
    await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
    await page.clock.runFor(100);
    await page.locator(`#${button}`).evaluate(button => button.click());
    await page.clock.runFor(601);
    await expect(page.locator('#solvedPanel')).toBeHidden();
    expect(await page.evaluate(() => window.resultRequests ?? [])).toEqual([]);
  });
}

test('toggling highlights preserves the pending completion without another ad', async ({ page }) => {
  await page.locator('#board').evaluate((board, position) => board.setPosition(position, false), eightQueens);
  await page.clock.runFor(100);
  await page.locator('#highlightSwitch').evaluate(button => button.click());
  await page.clock.runFor(401);
  await expect(page.locator('#solvedPanel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.resultRequests?.length ?? 0)).toBe(1);
  await page.clock.runFor(601);
  expect(await page.evaluate(() => window.resultRequests)).toHaveLength(1);
});

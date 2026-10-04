import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.sparePieces);
}
async function drag(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}
async function position(page) { return page.locator('#board').evaluate(board => board.position); }

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
});

test('native shelf supports selection, placement, dragging, removal and keyboard controls', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Place knight', exact: true }).click();
  await expect(page.locator('#selected-name')).toHaveText('Knight');
  await page.getByRole('button', { name: 'a1, empty', exact: true }).click();
  expect(await position(page)).toEqual({ a1: 'wN' });
  await drag(page, page.getByRole('button', { name: 'a1, Knight', exact: true }), page.getByRole('button', { name: 'b3, empty', exact: true }));
  expect(await position(page)).toEqual({ b3: 'wN' });
  await drag(page, page.getByRole('button', { name: 'Place knight', exact: true }), page.getByRole('button', { name: 'd4, empty', exact: true }));
  expect(await position(page)).toEqual({ b3: 'wN', d4: 'wN' });
  await page.getByRole('button', { name: 'b3, Knight', exact: true }).click();
  expect(await position(page)).toEqual({ d4: 'wN' });
  await drag(page, page.getByRole('button', { name: 'd4, Knight', exact: true }), page.locator('#topbar'));
  expect(await position(page)).toEqual({});
  await page.getByRole('button', { name: 'Place queen', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'a1, empty', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await position(page)).toEqual({ b1: 'wQ' });
});

test('phone taps and native touch drags work, with cancellation restoring the source', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
  const page = await context.newPage();
  await ready(page);
  const client = await context.newCDPSession(page);
  async function touchDrag(source, target, cancel = false) {
    const a = await source.boundingBox(), b = await target.boundingBox();
    const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  }
  await page.getByRole('button', { name: 'Place knight', exact: true }).tap();
  await expect(page.locator('#selected-name')).toHaveText('Knight');
  await page.getByRole('button', { name: 'a1, empty', exact: true }).tap();
  expect(await position(page)).toEqual({ a1: 'wN' });
  await touchDrag(page.getByRole('button', { name: 'a1, Knight', exact: true }), page.getByRole('button', { name: 'b3, empty', exact: true }));
  expect(await position(page)).toEqual({ b3: 'wN' });
  await touchDrag(page.getByRole('button', { name: 'b3, Knight', exact: true }), page.getByRole('button', { name: 'c5, empty', exact: true }), true);
  expect(await position(page)).toEqual({ b3: 'wN' });
  await page.getByRole('button', { name: 'b3, Knight', exact: true }).tap();
  expect(await position(page)).toEqual({});
  await touchDrag(page.getByRole('button', { name: 'Place queen', exact: true }), page.getByRole('button', { name: 'e4, empty', exact: true }));
  expect(await position(page)).toEqual({ e4: 'wQ' });
  await context.close();
});

test('repeated examples use distinct generator solutions and report optimal completion', async ({ page }) => {
  await ready(page);
  await page.locator('#dominationBtn').click();
  let previous;
  for (let i = 0; i < 10; i++) {
    await page.locator('#exampleBtn').click();
    const signature = Object.keys(await position(page)).sort().join(',');
    expect(signature).not.toBe(previous);
    previous = signature;
    await expect(page.locator('#hint')).toHaveText('Optimal solution. Every square is covered.');
  }
  await page.getByRole('button', { name: 'Place king', exact: true }).click();
  await page.locator('#exampleBtn').click();
  await page.locator('#board').evaluate(board => {
    const pos = { ...board.position };
    for (const file of 'abcdefgh') for (let rank = 1; rank <= 8; rank++) {
      const square = file + rank;
      if (!pos[square]) { pos[square] = 'wK'; board.setPosition(pos, false); return; }
    }
  });
  await expect(page.locator('#hint')).toHaveText('Every square is covered. Try using fewer pieces.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#exampleBtn').click();
  expect(await page.locator('#board').evaluate(board => board._animations.size)).toBe(0);
});

test('saved score differences appear inline, with exact and absent records neutral', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('scores', JSON.stringify({ MIN: { Q: { pb: 7 }, R: { pb: 8 } }, MAX: { Q: { pb: 6 }, R: { pb: 8 } } }));
  });
  await ready(page);
  for (const [mode, difference, description] of [['dominationBtn', '+2', '2 extra pieces above the minimum'], ['nonAttackingBtn', '−2', '2 pieces below the maximum']]) {
    await page.locator(`#${mode}`).click();
    await page.locator('#statsBtn').click();
    await expect(page.locator('#statsPanel thead th')).toHaveCount(4);
    await expect(page.locator('[data-score-piece="Q"] .score-difference')).toHaveText(difference);
    await expect(page.locator('[data-score-piece="Q"] .score-difference')).toHaveAttribute('aria-label', description);
    await expect(page.locator('[data-score-piece="R"] .score-difference:not([hidden])')).toHaveCount(0);
    await expect(page.locator('[data-score-piece="N"] .score-difference:not([hidden])')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

for (const [width, height] of [[320, 568], [390, 664], [390, 844], [1920, 1080]]) {
  test(`instructions show square illustrations and dialogs fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.locator('#aboutBtn').click();
    const cells = await page.locator('.mini-board span').evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect(); return Math.abs(rect.width - rect.height);
    }));
    expect(cells).toHaveLength(32);
    expect(cells.every(difference => difference < 0.1)).toBe(true);
    const fits = dialog => {
      const rect = dialog.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight && dialog.scrollHeight <= dialog.clientHeight && dialog.scrollWidth <= dialog.clientWidth;
    };
    expect(await page.locator('#instructions').evaluate(fits)).toBe(true);
    await page.keyboard.press('Escape');
    await page.locator('#statsBtn').click();
    expect(await page.locator('#statsPanel').evaluate(fits)).toBe(true);
  });
}

test('placement and reset MP3s play, while muting prevents playback', async ({ page }) => {
  await page.addInitScript(() => {
    window.playedSounds = [];
    document.addEventListener('playing', event => window.playedSounds.push(event.target.src), true);
    const OriginalAudio = window.Audio;
    window.Audio = function (...args) {
      const audio = new OriginalAudio(...args);
      audio.addEventListener('playing', () => window.playedSounds.push(audio.src));
      return audio;
    };
  });
  await ready(page);
  await page.getByRole('button', { name: 'a1, empty', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.playedSounds.filter(src => /click\d\.mp3$/.test(src)).length)).toBe(1);
  await page.locator('#soundSwitch').click();
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'b2, empty', exact: true }).click();
  expect(await page.evaluate(() => window.playedSounds.length)).toBe(1);
  await page.locator('#soundSwitch').click();
  await expect.poll(() => page.evaluate(() => window.playedSounds.length)).toBe(2);
  await page.locator('#statsBtn').click();
  await page.locator('#resetBtn').click();
  await expect.poll(() => page.evaluate(() => window.playedSounds.some(src => src.endsWith('/beeps.mp3')))).toBe(true);
  await expect(page.locator('#statsPanel')).not.toHaveClass(/scores-resetting/);
});

test('quantities count through integers, handle interruption and respect reduced motion', async ({ page }) => {
  await ready(page);
  await page.locator('#dominationBtn').click();
  await expect(page.locator('#coveredCount')).toHaveText('0');
  await page.evaluate(() => {
    window.quantityChanges = [];
    new MutationObserver(() => window.quantityChanges.push(Number(document.querySelector('#coveredCount').textContent)))
      .observe(document.querySelector('#coveredCount'), { childList: true });
    document.querySelector('#board').setPosition({ d4: 'wQ' }, false);
  });
  await expect(page.locator('#coveredCount')).toHaveText('28');
  expect(await page.evaluate(() => window.quantityChanges)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  await page.locator('#clearBtn').click();
  await page.locator('#nonAttackingBtn').click();
  await expect(page.locator('#coveredCount')).toHaveText('0');
  await expect(page.locator('#optimalCount')).toHaveText('8');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.querySelector('#board').setPosition({ a1: 'wQ', b3: 'wQ' }, false));
  await expect(page.locator('#pieceCount')).toHaveText('2');
  await expect(page.locator('#coveredCount')).toHaveText('2');
  await page.locator('#dominationBtn').click();
  expect(await page.locator('#optimalCount').textContent()).toBe('5');
  expect(await page.locator('.mode').evaluate(el => getComputedStyle(el, '::before').transitionDuration)).toBe('0s');
});

test('queen rays follow ranks, files and diagonals without hitting the other queen', async ({ page }) => {
  await ready(page);
  const lines = await page.locator('#safe-demo line').evaluateAll(elements => elements.map(el =>
    ['x1', 'y1', 'x2', 'y2'].map(name => Number(el.getAttribute(name)))));
  expect(lines.length).toBe(8);
  for (const [x1, y1, x2, y2] of lines) {
    const dx = x2 - x1, dy = y2 - y1;
    expect(dx === 0 || dy === 0 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.001).toBe(true);
    for (const [x, y] of [[.5, 3.5], [2.5, .5]]) {
      const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
      if (t > 0 && t < 1) expect(Math.hypot(x1 + t * dx - x, y1 + t * dy - y)).toBeGreaterThan(.3);
    }
  }
});

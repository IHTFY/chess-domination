import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
});

async function drag(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('a drop whose dragged piece element is gone during the snap still ends the drag', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#board')?.sparePieces);
  const board = page.locator('#board');
  // Lit looks the element up on each read; once the drag state is cleared it is null.
  await board.evaluate(el => {
    window.snapEnds = 0;
    el.addEventListener('snap-end', () => window.snapEnds++);
    Object.defineProperty(el, '_draggedPieceElement', { configurable: true, get: () => null });
  });
  await drag(page, page.getByRole('button', { name: 'Place knight', exact: true }), page.getByRole('button', { name: 'd 4, empty', exact: true }));
  await expect.poll(() => board.evaluate(el => el._dragState)).toBeUndefined();
  expect(errors).toEqual([]);
  expect(await board.evaluate(el => el.position)).toEqual({ d4: 'wN' });
  expect(await page.evaluate(() => window.snapEnds)).toBe(1);
  // The board takes the next drag.
  await board.evaluate(el => delete el._draggedPieceElement);
  await drag(page, page.getByRole('button', { name: 'd 4, Knight', exact: true }), page.getByRole('button', { name: 'b 3, empty', exact: true }));
  await expect.poll(() => board.evaluate(el => el.position)).toEqual({ b3: 'wN' });
  expect(errors).toEqual([]);
});

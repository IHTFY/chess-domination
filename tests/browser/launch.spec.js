import { test, expect } from '@playwright/test';

// Playwright can't open a page as an installed app, so the head script's display-mode query answers yes.
const installed = () => {
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => query.includes('display-mode') ? { matches: true, media: query } : matchMedia(query);
};

test('a browser tab never shows the launch screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('launching'))).toBe(false);
  await expect(page.locator('#launch')).toBeHidden();
});

test('an installed launch plays once, and a key during it only skips it', async ({ page }) => {
  await page.addInitScript(installed);
  // Slow the exit down so the key surely lands during it; the head script's 2 s fallback still holds.
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      animation.playbackRate = 0.1;
      return animation;
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('#launch')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('launching'))).toBe(false);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);

  await page.reload();
  await expect(page.locator('#board')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('launching'))).toBe(false);
});

test('under reduced motion the launch screen fades out and the game takes input', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(installed);
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    window.launchAnimations = [];
    Element.prototype.animate = function (keyframes, options) {
      window.launchAnimations.push([this.id, Object.keys(keyframes)]);
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto('/');
  await expect(page.locator('#launch')).toHaveCount(0);
  expect(await page.evaluate(() => window.launchAnimations)).toEqual([['launch', ['opacity']]]);
  await page.locator('#dominationBtn').click();
  await expect(page.locator('#dominationBtn')).toHaveAttribute('aria-pressed', 'true');
});

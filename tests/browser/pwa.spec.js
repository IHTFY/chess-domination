import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const workerPath = new URL('../../service-worker.js', import.meta.url);

test('manifest parses and declares decodable icons with accurate sizes and safe masks', async ({ page, context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const session = await context.newCDPSession(page);
  const parsed = await session.send('Page.getAppManifest');
  expect(parsed.errors).toEqual([]);
  const manifest = JSON.parse(parsed.data);
  expect(manifest.id).toBe('./index.html');
  expect(manifest.start_url).toBe('./index.html');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe(manifest.theme_color);
  expect(manifest.icons.filter(icon => icon.purpose === 'maskable').map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
  expect(manifest.icons.filter(icon => icon.type === 'image/png' && icon.purpose === 'any').map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
  for (const icon of manifest.icons) {
    const result = await page.evaluate(async icon => {
      const image = new Image();
      image.src = icon.src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = false;
      let outsideSafeZone = false;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          if (data[offset + 3] !== 255) transparent = true;
          if (Math.hypot(x + 0.5 - canvas.width / 2, y + 0.5 - canvas.height / 2) > canvas.width * 0.4 &&
            (data[offset] !== 11 || data[offset + 1] !== 23 || data[offset + 2] !== 48)) outsideSafeZone = true;
        }
      }
      return { width: image.naturalWidth, height: image.naturalHeight, transparent, outsideSafeZone };
    }, icon);
    expect(result.transparent).toBe(false);
    if (icon.sizes !== 'any') expect(`${result.width}x${result.height}`).toBe(icon.sizes);
    if (icon.purpose === 'maskable') expect(result.outsideSafeZone).toBe(false);
  }
  const installability = await session.send('Page.getInstallabilityErrors');
  expect(installability.installabilityErrors).toEqual([]);
});

test('manifest, install artwork and favicon fallbacks remain available offline', async ({ page, context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:8765(?:\/|$))/, route => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await context.setOffline(true);
  const results = await page.evaluate(async () => {
    const response = await fetch('manifest.json');
    const manifest = await response.json();
    const urls = [...manifest.icons.map(icon => icon.src),
      'favicons/apple-touch-icon.png', 'favicons/favicon.ico', 'favicons/favicon-16x16.png',
      'favicons/favicon-32x32.png', 'favicons/browserconfig.xml', 'favicons/mstile-150x150.png'];
    return Promise.all(urls.map(async url => ({ url, ok: (await fetch(url)).ok })));
  });
  expect(results.filter(result => !result.ok)).toEqual([]);
});

test('a changed service worker waits, prompts, and reloads only when the user accepts', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  // Playwright cannot intercept worker script fetches, so change the file itself.
  const original = readFileSync(workerPath, 'utf8');
  try {
    writeFileSync(workerPath, `${original}\n// test update\n`);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => reg.update()));
  const action = page.locator('.toast .toast-action');
  await expect(action).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => Boolean(reg.waiting)))).toBe(true);
  const reloaded = page.waitForEvent('load');
  await action.click();
  await reloaded;
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  } finally {
    writeFileSync(workerPath, original);
  }
});

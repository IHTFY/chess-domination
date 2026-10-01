import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Rasterize the source vector with our pinned browser, without new dependencies.
const directory = new URL('../favicons/', import.meta.url);
const source = await readFile(new URL('icon.svg', directory), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (size, maskable = false) => {
    await page.setViewportSize({ width: size, height: size });
    const svg = maskable
      ? source.replace(/(<rect x="0"[^>]*\/>)/, '$1<g transform="translate(15.36 15.36) scale(0.94)">').replace('</svg>', '</g></svg>')
      : source;
    await page.setContent(`<style>html,body{margin:0;background:#0b1730}img{display:block;width:100vw;height:100vh}</style><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
    await page.locator('img').evaluate(image => image.decode());
    return page.screenshot({ type: 'png' });
  };
  const outputs = [
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32],
    ['apple-touch-icon.png', 180],
    ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512],
    ['maskable-192x192.png', 192, true], ['maskable-512x512.png', 512, true],
    ['mstile-150x150.png', 150], ['large.png', 1224],
  ];
  for (const [name, size, maskable] of outputs) {
    await writeFile(new URL(name, directory), await render(size, maskable));
    console.log(`Generated ${name}`);
  }
  // ICO container with PNG payloads for modern Windows/browser fallback.
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push(await render(size));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + 16 * index;
    header[entry] = header[entry + 1] = sizes[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await writeFile(new URL('favicon.ico', directory), Buffer.concat([header, ...images]));
  console.log('Generated favicon.ico (16, 32, 48 px)');
} finally {
  await browser.close();
}

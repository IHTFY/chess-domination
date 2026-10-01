# Total Field Blue

`icon.svg` is the editable vector source for all production icon assets. The palette
is navy `#0b1730`, slate blues `#203c60` / `#31577c`, and pale blue `#8bd0ff`.

Regenerate with the pinned Playwright Chromium renderer:

```sh
npm ci
npx playwright install chromium
npm run icons:generate
```

Outputs:
- Standard PWA PNGs: 192 and 512 px, plus the scalable SVG.
- Dedicated maskable PNGs: 192 and 512 px with slightly more padding. All foreground
  artwork stays inside the centered safe circle of radius 40% of icon width.
- Apple touch icon: 180 px, opaque and square so the OS can apply its own mask.
- PNG favicons: 16 and 32 px; ICO fallback contains 16, 32, and 48 px PNG frames.
- Windows tile: 150 px. The existing 1224 px `large.png` is retained as a high-resolution export.

Do not bake rounded corners into the assets. The manifest separates standard and
maskable purposes; the HTML declares Apple touch and favicon fallbacks. The manifest
ID deliberately matches the previous inferred identity (`./index.html`).

Run `npm run check` after regeneration and bump the service-worker cache version
when changing assets. Browser tests check manifest parsing/installability in Chromium,
actual icon sizes, maskable safe zones, opaque backgrounds, and offline asset access.
Native installation on Apple and Android devices is not covered by these tests.

References: [manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)
and [maskable safe zones](https://web.dev/articles/maskable-icon).

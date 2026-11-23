# Modernist print

`icon.svg` is the editable vector source for all production icon assets, traced from the
picked concept. The palette is cream `#fcf1e0` (the page background), green `#255d4e`,
coral `#f15e6a`, and ink `#321a23`.

Regenerate with the pinned Playwright Chromium renderer:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm icons:generate
```

Outputs:
- Standard PWA PNGs: 192 and 512 px, plus the scalable SVG.
- Dedicated maskable PNGs: 192 and 512 px without the ink frame, with the art scaled to
  76% so the board's corners stay inside the centered safe circle of radius 40% of icon
  width. The launch animation in `index.html` copies this layout.
- Apple touch icon: 180 px, opaque and square so the OS can apply its own mask.
- PNG favicons: 16 and 32 px; ICO fallback contains 16, 32, and 48 px PNG frames.
- Windows tile: 150 px. The existing 1224 px `large.png` is retained as a high-resolution export.

Do not bake rounded corners into the assets. The manifest separates standard and
maskable purposes; the HTML declares Apple touch and favicon fallbacks. The manifest
ID deliberately matches the previous inferred identity (`./index.html`).

Run `pnpm check` after regeneration and bump the service-worker cache version
when changing assets. Browser tests check manifest parsing/installability in Chromium,
actual icon sizes, maskable safe zones, opaque backgrounds, and offline asset access.
Native installation on Apple and Android devices is not covered by these tests.

References: [manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)
and [maskable safe zones](https://web.dev/articles/maskable-icon).

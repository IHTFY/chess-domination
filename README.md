# Domination

A chess puzzle game: variations of the Eight Queens Problem and domination numbers.

[Read the blog post](https://ihtfy.com/domination/).

## Run locally

The site is static HTML, CSS and JavaScript; deployment needs no build step.
Use Node.js 24 LTS (minimum 22.13) and Python 3 for the development tools:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Open http://127.0.0.1:8000. Service workers require localhost or HTTPS.

## Checks

```sh
npx playwright install chromium
pnpm check
```

On Linux CI, install browser OS dependencies with `npx playwright install --with-deps chromium`.
The check runs ESLint, verifies the vendored dependencies, tests storage recovery,
and runs Chromium regression tests. Browser coverage includes 6,000 seeded solver
positions across all pieces and modes, validator edge cases, controls and score
persistence, blocked audio/storage, offline reload with the HTTP cache disabled, and
no-scroll, no-overlap layouts across phone, tablet and desktop viewports.
The cobalt interface also has checks for native mouse and touch dragging,
keyboard placement, animated example generation, saved score differences,
square instruction illustrations, attack rays, integer count transitions, reduced motion,
and MP3 playback. External scripts are blocked
in tests. GitHub Actions runs these checks on PRs and master.

## Dependencies

Runtime files remain committed so static hosting and offline play do not depend on
`node_modules` or a CDN. Exact versions and their dependency trees are recorded in
`package.json` and `pnpm-lock.yaml`:

| Package | Version | Committed files |
| --- | --- | --- |
| `chessboard-element` | 1.2.0 | `scripts/chessboard-element.bundled.js` from `bundled/` |

`pnpm check:vendor` compares these files with the installed packages, allowing
only historical line-ending and license-header whitespace differences. The Lit
runtime is embedded in the chessboard bundle; updating a transitive npm dependency
alone will not change that bundle.

Controls, dialogs, animations and update notifications use local CSS and vanilla JavaScript.
The chessboard component provides piece rendering and drag interactions.

To update a runtime dependency, install an exact version with `pnpm add --save-exact`,
copy the corresponding published files into the locations above, run `pnpm sw:stamp`, and run `pnpm check`. Commit the lockfile and vendor files
alongside the change. No dependency update is deployed merely by editing the manifest.

## Offline caching and saved data

The service worker precaches the app and serves known assets from its cache. Navigation
is network-first with a 3 second timeout, falling back to the cached shell when offline
or on a flaky connection. Run `pnpm sw:stamp` after changing any precached file (or
add new runtime files to `FILES_TO_CACHE` first): it stamps a content hash into
`service-worker.js` as the cache version, and `pnpm check` fails if the stamp is stale.

Updates never apply mid-game. A new worker installs in the background and waits; the page
shows an "Update" toast, and choosing it activates the new worker and reloads. The page
also checks for updates hourly and whenever it becomes visible. Cache names include this
app's registration scope; activation deletes only older caches with that prefix. The old
generic `static-cache-v1` cache is deliberately left alone because its name does not
establish ownership on a shared origin.

Settings and personal bests stay in local storage under the existing keys. Invalid
or missing values recover to defaults while valid records survive. If storage is
blocked or full, the game remains playable, but changes cannot persist across reloads.

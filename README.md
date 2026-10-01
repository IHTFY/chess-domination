# Domination

A chess puzzle game: variations of the Eight Queens Problem and domination numbers.

[Read the blog post](https://ihtfy.com/domination/).

## Run locally

The site is static HTML, CSS and JavaScript; deployment needs no build step.
Use Node.js 24 LTS (minimum 22.13) and Python 3 for the development tools:

```sh
npm ci
npm start
```

Open http://127.0.0.1:8000. Service workers require localhost or HTTPS.

## Checks

```sh
npx playwright install chromium
npm run check
```

On Linux CI, install browser OS dependencies with `npx playwright install --with-deps chromium`.
The check runs ESLint, verifies the vendored dependencies, tests storage recovery,
and runs Chromium regression tests. Browser coverage includes 6,000 seeded solver
positions across all pieces and modes, validator edge cases, controls and score
persistence, blocked audio/storage, offline reload with the HTTP cache disabled, and
no-scroll, no-overlap layouts across phone, tablet and desktop viewports.
External scripts are blocked in tests. GitHub Actions runs these checks on PRs and master.

## Dependencies

Runtime files remain committed so static hosting and offline play do not depend on
`node_modules` or a CDN. Exact versions and their dependency trees are recorded in
`package.json` and `package-lock.json`:

| Package | Version | Committed files |
| --- | --- | --- |
| `chessboard-element` | 1.2.0 | `scripts/chessboard-element.bundled.js` from `bundled/` |
| `@materializecss/materialize` | 1.1.0 | `style/materialize.min.css` and `.js` from `dist/css/` and `dist/js/` |

`npm run check:vendor` compares these files with the installed packages, allowing
only historical line-ending and license-header whitespace differences. The Lit
runtime is embedded in the chessboard bundle; updating a transitive npm dependency
alone will not change that bundle.

As checked on October 1, 2026, chessboard-element 1.2.0 is the latest stable release.
Materialize [2.4.0 is available](https://github.com/materializecss/materialize/releases/tag/v2.4.0),
but its major upgrade is deferred to the planned UI redesign and visual regression
checks. The unused, unpinned `@pwabuilder/pwainstall` CDN import has been removed.

To update a runtime dependency, install an exact version with `npm install --save-exact`,
copy the corresponding published files into the locations above, update the service
worker cache version, and run `npm run check`. Commit the lockfile and vendor files
alongside the change. No dependency update is deployed merely by editing the manifest.

## Offline caching and saved data

The service worker precaches the app, serves known assets from its cache, and falls
back to cached HTML when navigation fails offline. Bump the cache version in
`service-worker.js` whenever a precached file changes, and list any new runtime files
there. Cache names include this app's registration scope; activation deletes only
older caches with that prefix. The old generic `static-cache-v1` cache is deliberately
left alone because its name does not establish ownership on a shared origin.

Settings and personal bests stay in local storage under the existing keys. Invalid
or missing values recover to defaults while valid records survive. If storage is
blocked or full, the game remains playable, but changes cannot persist across reloads.

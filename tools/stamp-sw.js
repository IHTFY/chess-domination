// Stamps service-worker.js with a hash of every precached file.
// `node tools/stamp-sw.js --check` fails if the stamp is stale.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const swPath = new URL('service-worker.js', root);
const source = readFileSync(swPath, 'utf8');

const list = source.match(/const FILES_TO_CACHE = \[([\s\S]*?)\];/)[1];
const files = [...list.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).sort();

const hash = createHash('sha256');
// Hash the worker with its version blanked so stamping is idempotent.
hash.update(source.replace(/const VERSION = '[^']*';/, "const VERSION = '';"));
for (const file of files) hash.update(file).update(readFileSync(new URL(file, root)));
const version = hash.digest('hex').slice(0, 12);

const stamped = source.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
if (process.argv.includes('--check')) {
  if (stamped !== source) {
    console.error('service-worker.js version is stale. Run `pnpm sw:stamp`.');
    process.exit(1);
  }
} else {
  writeFileSync(swPath, stamped);
  console.log(`service-worker.js stamped ${version} (${files.length} files)`);
}

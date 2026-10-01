import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = [
  ['scripts/chessboard-element.bundled.js', 'chessboard-element/bundled/chessboard-element.bundled.js'],
  ['style/materialize.min.js', '@materializecss/materialize/dist/js/materialize.min.js'],
  ['style/materialize.min.css', '@materializecss/materialize/dist/css/materialize.min.css'],
];
// Historical copies differ only in line endings and whitespace after the license header.
const normalize = text => text.replace(/\r\n/g, '\n').replace(/^(\/\*![\s\S]*?\*\/)\s*/, '$1\n').trim();
for (const [local, source] of files) {
  const [actual, expected] = await Promise.all([
    readFile(new URL(`../${local}`, import.meta.url), 'utf8'),
    readFile(new URL(`../node_modules/${source}`, import.meta.url), 'utf8'),
  ]);
  assert.ok(normalize(actual) === normalize(expected), `${local} differs from the pinned package`);
  console.log(`${local}: matches pinned package`);
}

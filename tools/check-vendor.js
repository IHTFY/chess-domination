import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = [
  ['scripts/chessboard-element.bundled.js', 'chessboard-element/bundled/chessboard-element.bundled.js'],
];
// Historical copies differ only in line endings and whitespace after the license header.
const normalize = text => text.replace(/\r\n/g, '\n').replace(/^(\/\*![\s\S]*?\*\/)\s*/, '$1\n').trim();
// Local patch: a drag's transitionend handler can run after the dragged piece's element is gone,
// which threw before the drag finished. The handlers skip the removal when it is missing.
const note = "/* Local patch (checked by tools/check-vendor.js): a drag's transitionend handler can run after the dragged piece's element is gone, so removeEventListener uses ?. instead of throwing. */";
const patch = text => {
  assert.ok(text.includes('this._draggedPieceElement.removeEventListener('), 'the pinned package no longer needs the drag patch');
  return `${note}\n${text.replaceAll('this._draggedPieceElement.removeEventListener(', 'this._draggedPieceElement?.removeEventListener(')}`;
};
for (const [local, source] of files) {
  const [actual, expected] = await Promise.all([
    readFile(new URL(`../${local}`, import.meta.url), 'utf8'),
    readFile(new URL(`../node_modules/${source}`, import.meta.url), 'utf8'),
  ]);
  assert.ok(normalize(actual) === patch(normalize(expected)), `${local} differs from the pinned package`);
  console.log(`${local}: matches pinned package`);
}

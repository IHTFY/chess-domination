import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = [
  ['scripts/chessboard-element.bundled.js', 'chessboard-element/bundled/chessboard-element.bundled.js'],
];
// Historical copies differ only in line endings and whitespace after the license header.
const normalize = text => text.replace(/\r\n/g, '\n').replace(/^(\/\*![\s\S]*?\*\/)\s*/, '$1\n').trim();
// Local patch: a drag's transitionend handler can run after the dragged piece's element is gone,
// which threw before the drag finished. The handlers skip the removal when it is missing. A drop
// (snap, snapback or trash) that finds the element already gone has no transition to wait for, so
// it finishes at once through the same handler, and the drag state returns to normal.
const note = "/* Local patch (checked by tools/check-vendor.js): a drag's transitionend handler can run after the dragged piece's element is gone, so removeEventListener uses ?. instead of throwing, and a snap, snapback or trash that finds the element already gone finishes at once instead of calling addEventListener on null. */";
const listen = /this\._draggedPieceElement\.addEventListener\("transitionend",(\w+)\)/g;
const patch = text => {
  assert.ok(text.includes('this._draggedPieceElement.removeEventListener('), 'the pinned package no longer needs the drag patch');
  assert.ok(listen.test(text), 'the pinned package no longer needs the drag patch');
  const guarded = text
    .replaceAll('this._draggedPieceElement.removeEventListener(', 'this._draggedPieceElement?.removeEventListener(')
    .replace(listen, (_, handler) => `this._draggedPieceElement?this._draggedPieceElement.addEventListener("transitionend",${handler}):${handler}()`);
  return `${note}\n${guarded}`;
};
for (const [local, source] of files) {
  const [actual, expected] = await Promise.all([
    readFile(new URL(`../${local}`, import.meta.url), 'utf8'),
    readFile(new URL(`../node_modules/${source}`, import.meta.url), 'utf8'),
  ]);
  assert.ok(normalize(actual) === patch(normalize(expected)), `${local} differs from the pinned package`);
  console.log(`${local}: matches pinned package`);
}

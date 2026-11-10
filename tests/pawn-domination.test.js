import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The board component only runs in a browser; findIssues and storage never call into it.
const stubBoard = `
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('chessboard-element.bundled.js')) {
    return {
      url: 'data:text/javascript,export const objToFen=()=>"";export const fenToObj=()=>({});',
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(stubBoard)}`);
const { findIssues } = await import('../scripts/findIssues.js');
const { defaultScores, readScores } = await import('../scripts/storage.js');

const files = 'abcdefgh';
// Rows are bitmasks over files a..h (bit 0 is file a).
const squaresOf = (mask, rank) => [...files].flatMap((f, i) => (mask >> i & 1 ? [f + rank] : []));
const boardOf = rows => Object.fromEntries(
  rows.flatMap((mask, i) => squaresOf(mask, i + 1).map(square => [square, 'wP'])),
);
const popcount = mask => squaresOf(mask, 1).length;

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

// Smallest number of pawns that cover every square under the game's own rule (findIssues, MIN mode).
// A pawn only reaches the rank above its own, so each rank depends on the rank below it:
// search rank by rank, keeping the cheapest cost for each possible row below.
const fewestPawns = () => {
  const rank3Uncovered = (below, row) =>
    findIssues(boardOf([0, below, row]), 'MIN').filter(square => square[1] === '3');
  const allRows = Array.from({ length: 256 }, (_, mask) => mask);
  let costs = new Map([[0, 0]]); // nothing sits below rank 1
  for (let rank = 1; rank <= 8; rank++) {
    const next = new Map();
    for (const [below, cost] of costs) {
      for (const row of allRows) {
        // The empty board has no piece type, so findIssues has nothing to test; it covers nothing.
        const covered = row === 0 && below === 0 ? false : rank3Uncovered(below, row).length === 0;
        if (!covered) continue;
        const total = cost + popcount(row);
        if (total < (next.get(row) ?? Infinity)) next.set(row, total);
      }
    }
    costs = next;
  }
  return Math.min(...costs.values());
};

// Rows from rank 1 to rank 7; rank 8 is empty.
const pawns28 = [0xFF, 0b01001000, 0b01001011, 0b01001000, 0b01001011, 0b01001000, 0b11001111, 0];

test('no board with fewer than 28 pawns covers every square', () => {
  assert.equal(fewestPawns(), 28);
});

test('a 28-pawn board passes the game checker', () => {
  const position = boardOf(pawns28);
  assert.equal(Object.keys(position).length, 28);
  assert.deepEqual(findIssues(position, 'MIN'), []);
});

test('the pawn Domination minimum is 28', () => {
  assert.equal(defaultScores.MIN.P.wr, 28);
});

test('a saved pawn Domination record of 28 is kept on reload', () => {
  const values = { scores: JSON.stringify({ MIN: { P: { pb: 28 } } }) };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = value; } },
  });
  assert.equal(readScores().MIN.P.pb, 28);
});

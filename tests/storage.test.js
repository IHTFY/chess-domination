import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { defaultScores, readScores, readMode, readBoolean, writeStored } from '../scripts/storage.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

function storage(values = {}) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => values[key] ?? null,
      setItem: (key, value) => { values[key] = value; },
    },
  });
  return values;
}

test('missing, malformed and wrong-shaped saved scores recover to defaults', () => {
  for (const scores of [undefined, '{', 'null', '[]', '42', '"text"', '{"MAX":null}']) {
    storage({ scores });
    assert.deepEqual(readScores(), defaultScores);
  }
});

test('valid personal bests survive partial data; perfect scores come from code', () => {
  storage({ scores: JSON.stringify({
    MAX: { Q: { pb: 7, wr: 99 }, N: { pb: 33 }, B: { pb: -1 } },
    MIN: { Q: { pb: 6 }, K: { pb: 8 }, R: { pb: 8.5 }, P: { pb: '32' } },
  }) });
  const expected = structuredClone(defaultScores);
  expected.MAX.Q.pb = 7;
  expected.MIN.Q.pb = 6;
  assert.deepEqual(readScores(), expected);
  const scores = readScores();
  scores.MAX.Q.pb = 0;
  assert.equal(readScores().MAX.Q.pb, 7);
  assert.equal(defaultScores.MAX.Q.pb, 0);
});

test('settings validate types and preserve explicit false and MIN', () => {
  const values = storage({ gameMode: 'MIN', soundMode: 'false', hilight: 'true' });
  assert.equal(readMode(), 'MIN');
  assert.equal(readBoolean('soundMode'), false);
  assert.equal(readBoolean('hilight'), true);
  values.gameMode = 'invalid';
  assert.equal(readMode(), 'MAX');
  for (const value of ['{', 'null', '0', '"false"']) {
    values.soundMode = value;
    assert.equal(readBoolean('soundMode'), true);
  }
  writeStored('soundMode', 'false');
  assert.equal(readBoolean('soundMode'), false);
});

test('blocked storage and failed writes do not prevent playing', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('Storage blocked'); },
  });
  assert.deepEqual(readScores(), defaultScores);
  assert.equal(readMode(), 'MAX');
  assert.equal(readBoolean('soundMode'), true);
  assert.doesNotThrow(() => writeStored('scores', '{}'));
  storage();
  globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.doesNotThrow(() => writeStored('scores', '{}'));
});

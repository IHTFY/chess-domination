import { objToFen, fenToObj } from 'https://unpkg.com/chessboard-element@1.2.0/lib/chessboard-element.js?module';

// array utility functions
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// convert piece abbreviation to piece type
const full = letter => ({
  'k': 'king',
  'q': 'queen',
  'r': 'rook',
  'b': 'bishop',
  'n': 'knight',
  'p': 'pawn',
}[letter?.toLowerCase()]);


// convert 1-8 <--> a-h
const letter = i => String.fromCharCode(96 + i);
const index = l => l.charCodeAt(0) - 96;

// transform a fen
const flipVertical = fen => fen.split('/').reverse().join('/');
const flipHorizontal = fen => fen.split('/').map(i => i.split('').reverse().join('')).join('/');
const rotate180 = fen => [...fen].reverse().join('');
const transpose = fen => {
  let newPos = {};
  for (const [key, value] of Object.entries(fenToObj(fen))) {
    newPos[letter(+key[1]) + index(key[0])] = value;
  }
  return objToFen(newPos);
};

// get all 8 symmetries of a fen
const getSymmetries = fen => {
  let t = transpose(fen);
  return [
    fen,                  // ᑭ
    flipVertical(fen),    // Ь
    flipHorizontal(fen),  // ᑫ
    rotate180(fen),       // ᑯ
    t,                    // ᓄ
    flipVertical(t),      // ᓀ
    flipHorizontal(t),    // ᓇ
    rotate180(t),         // ᓂ
  ]
};

const countPieces = pos => Object.values(pos).reduce((a, c) => {
  a[c[1]]++;
  return a;
}, { 'K': 0, 'Q': 0, 'R': 0, 'B': 0, 'N': 0, 'P': 0 });

export {
  pickRandom,
  shuffle,
  full,
  letter,
  index,
  flipVertical,
  flipHorizontal,
  rotate180,
  transpose,
  getSymmetries,
  countPieces,
};
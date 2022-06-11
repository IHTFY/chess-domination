// remove black pieces
document.querySelector('#board').shadowRoot.querySelector('[part=spare-pieces]').remove();

import { objToFen, fenToObj } from 'https://unpkg.com/chessboard-element@1.2.0/lib/chessboard-element.js?module';

/** GLOBAL VARIABLES */
let gameMode = 'MAX';
let scores = {
  'MAX': {
    'K': { 'pb': 0, 'wr': 16 },
    'Q': { 'pb': 0, 'wr': 8 },
    'R': { 'pb': 0, 'wr': 8 },
    'B': { 'pb': 0, 'wr': 14 },
    'N': { 'pb': 0, 'wr': 32 },
    'P': { 'pb': 0, 'wr': 32 },
  },
  'MIN': {
    'K': { 'pb': 64, 'wr': 9 },
    'Q': { 'pb': 64, 'wr': 5 },
    'R': { 'pb': 64, 'wr': 8 },
    'B': { 'pb': 64, 'wr': 8 },
    'N': { 'pb': 64, 'wr': 12 },
    'P': { 'pb': 64, 'wr': 32 },
  },
};

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
    fen,
    flipVertical(fen),
    flipHorizontal(fen),
    rotate180(fen),
    t,
    flipVertical(t),
    flipHorizontal(t),
    rotate180(t),
  ]
};

const board = document.querySelector('#board');
board.sparePieces = true;
board.draggablePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `https://lichess1.org/assets/_a8WL5z/piece/alpha/${piece}.svg`;


const countPieces = pos => Object.values(pos).reduce((a, c) => {
  a[c[1]]++;
  return a;
}, { 'K': 0, 'Q': 0, 'R': 0, 'B': 0, 'N': 0, 'P': 0 });


// Check if board position is valid solution for the current game mode
const isValid = (pos, mode) => {
  const occupied = Object.keys(pos);

  // if pos is empty, return false
  if (occupied.length === 0) return false;

  // if there is more than one type of piece, return false
  const pieceCount = countPieces(pos);
  if (Object.values(pieceCount).filter(i => i > 0).length > 1) return false;

  const pieceType = Object.values(pos)[0][1];


  const rows = new Set();
  const cols = new Set();
  const diags = new Set();
  const antidiags = new Set();
  for (let p of occupied) {
    const [f, r] = p.split('');
    rows.add(+r);
    cols.add(index(f));
    diags.add(+r + index(f));
    antidiags.add(index(f) - r);
  }

  switch (pieceType) {
    case 'K':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const [f, r] = v.split('');
          const [below, above] = [+r - 1, +r + 1];
          const [left, right] = [index(f) - 1, index(f) + 1].map(i => letter(i));
          return !pos[left + above] && !pos[f + above] && !pos[right + above] &&
            !pos[left + r] && !pos[right + r] &&
            !pos[left + below] && !pos[f + below] && !pos[right + below];
        });
      } else {
        let covered = new Set();

        // add a border of out of bounds squares (36 squares)
        for (let i = 0; i <= 9; i++) {
          covered.add(letter(0) + i); // left 
          covered.add(letter(9) + i); // right
        }
        for (let i = 1; i <= 8; i++) {
          covered.add(letter(i) + 9); // top
          covered.add(letter(i) + 0); // bottom
        }

        const oob = covered.size;

        for (let p of occupied) {
          // add all the squares around the king
          const [f, r] = p.split('');
          const [below, above] = [+r - 1, +r + 1];
          const [left, right] = [index(f) - 1, index(f) + 1].map(i => letter(i));
          covered.add(left + above);
          covered.add(f + above);
          covered.add(right + above);
          covered.add(left + r);
          covered.add(f + r)
          covered.add(right + r);
          covered.add(left + below);
          covered.add(f + below);
          covered.add(right + below);
        }

        return covered.size - oob === 64;
      }
    case 'Q':
      if (mode === 'MAX') {
        return rows.size === occupied.length &&
          cols.size === occupied.length &&
          diags.size === occupied.length &&
          antidiags.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(rows.has(r) || cols.has(f) || diags.has(f + r) || antidiags.has(f - r))) return false;

          }
        }
        return true;
      }
    case 'R':
      if (mode === 'MAX') {
        return rows.size === occupied.length
          && cols.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(rows.has(r) || cols.has(f))) return false;
          }
        }
        return true;
      }
    case 'B':
      if (mode === 'MAX') {
        return diags.size === occupied.length
          && antidiags.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(diags.has(f + r) || antidiags.has(f - r))) return false;
          }
        }
        return true;
      }
    case 'N':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const f = index(v[0]);
          const r = +v[1];
          // reference clockface
          const p1 = pos[letter(f + 1) + (r + 2)];
          const p2 = pos[letter(f + 2) + (r + 1)];
          const p4 = pos[letter(f + 2) + (r - 1)];
          const p5 = pos[letter(f + 1) + (r - 2)];
          const p7 = pos[letter(f - 1) + (r - 2)];
          const p8 = pos[letter(f - 2) + (r - 1)];
          const p10 = pos[letter(f - 2) + (r + 1)];
          const p11 = pos[letter(f - 1) + (r + 2)];

          return !(p1 || p2 || p4 || p5 || p7 || p8 || p10 || p11);
        });
      } else {
        // for each square, check if there is a knight on it or one jump away
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(occupied.includes(letter(f) + r) ||
              occupied.includes(letter(f + 1) + (r + 2)) ||
              occupied.includes(letter(f + 2) + (r + 1)) ||
              occupied.includes(letter(f + 2) + (r - 1)) ||
              occupied.includes(letter(f + 1) + (r - 2)) ||
              occupied.includes(letter(f - 1) + (r - 2)) ||
              occupied.includes(letter(f - 2) + (r - 1)) ||
              occupied.includes(letter(f - 2) + (r + 1)) ||
              occupied.includes(letter(f - 1) + (r + 2)))) return false;
          }
        }
        return true;
      }
    case 'P':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const f = index(v[0]);
          const ahead = +v[1] + 1;
          const left = pos[letter(f + 1) + ahead];
          const right = pos[letter(f - 1) + ahead];

          return !(left || right);
        });
      } else {
        // for each square, check if there is a pawn on it or attacking it
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(occupied.includes(letter(f) + r) ||
              occupied.includes(letter(f + 1) + (r - 1)) ||
              occupied.includes(letter(f - 1) + (r - 1)))) {
              console.log(letter(f) + r);
              return false;
            }
          }
        }
        return true;
      }
    default:
      return false;
  }
};


const updateStats = pos => {
  const pieceCount = countPieces(pos);

  document.querySelector('#kingCount').textContent = pieceCount['K'];
  document.querySelector('#queenCount').textContent = pieceCount['Q'];
  document.querySelector('#rookCount').textContent = pieceCount['R'];
  document.querySelector('#bishopCount').textContent = pieceCount['B'];
  document.querySelector('#knightCount').textContent = pieceCount['N'];
  document.querySelector('#pawnCount').textContent = pieceCount['P'];


  const pieceType = Object.values(pos)[0]?.[1];
  const pass = isValid(pos, gameMode);

  // default white
  document.querySelectorAll('[id*=Count]').forEach(e => e.style.color = 'white');
  // make text green if valid and red if not
  if (pieceType) {
    document.querySelector(`#${full(pieceType)}Count`).style.color = pass ? 'green' : 'red';
  };

  // Update the personal best
  if (pass) {
    scores[gameMode][pieceType]['pb'] = Math[gameMode.toLowerCase()](scores[gameMode][pieceType]['pb'], pieceCount[pieceType]);
  }

  // Update table
  document.querySelector('#kingBest').textContent = scores[gameMode]['K']['pb'];
  document.querySelector('#queenBest').textContent = scores[gameMode]['Q']['pb'];
  document.querySelector('#rookBest').textContent = scores[gameMode]['R']['pb'];
  document.querySelector('#bishopBest').textContent = scores[gameMode]['B']['pb'];
  document.querySelector('#knightBest').textContent = scores[gameMode]['N']['pb'];
  document.querySelector('#pawnBest').textContent = scores[gameMode]['P']['pb'];
};

board.addEventListener('change', e => {
  const { value, oldValue } = e.detail;
  updateStats(value);
});


/** Solutions */
const solveKing = () => {
  if (gameMode === 'MAX') {
    let pos = {};

    // check if there is a piece in a previous row or col
    const hasNeighbor = (pos, i, j) => {
      const left = String.fromCharCode(i - 1);
      const center = String.fromCharCode(i);
      const right = String.fromCharCode(i + 1);
      return (pos[left + (j + 1)] || pos[left + j] || pos[left + (j - 1)] ||
        pos[center + (j - 1)] || pos[right + (j - 1)]);
    };

    // pick random sub-square
    // weight toward bottom left since we constrain in that direction
    const randomSub = (i, j) => [
      pickRandom([i, i, i + 1]),
      pickRandom([j, j, j + 1]),
    ];

    // for each 2x2 subsquare: ex: a1, a2, b1, b2
    for (let i = 97; i <= 104; i += 2) {
      for (let j = 1; j <= 8; j += 2) {
        let [x, y] = randomSub(i, j);
        while (hasNeighbor(pos, x, y)) {
          [x, y] = randomSub(i, j);
        }
        pos[String.fromCharCode(x) + y] = 'wK';
      }
    }

    const posFEN = objToFen(pos);
    const symmetries = getSymmetries(posFEN);

    return fenToObj(pickRandom(symmetries));

  } else {
    // MIN to Dominate
    let pos = {};

    pos['d4'] = 'wK'; // center
    pos['g7'] = 'wK'; // NE


    pos[pickRandom(['d7', 'e7'])] = 'wK'; // N
    pos[pickRandom(['g4', 'g5'])] = 'wK'; // E

    if (pos['e7']) {
      pos['b7'] = 'wK'; // forced to hit the NW and c6
    } else {
      pos[pickRandom(['a7', 'a8', 'b7', 'b8'])] = 'wK';
    }

    if (pos['g5']) {
      pos['g2'] = 'wK'; // forced to hit the SE and f3
    } else {
      pos[pickRandom(['g1', 'g2', 'h1', 'h2'])] = 'wK';
    }

    if (pos['a8'] || pos['b8']) {
      pos[pickRandom(['a5', 'b5'])] = 'wK'; // forced to hit 6 and 4 ranks
    } else {
      pos[pickRandom(['a5', 'b5', 'a4', 'b4'])] = 'wK';
    };


    if (pos['h1'] || pos['h2']) {
      pos[pickRandom(['e1', 'e2'])] = 'wK'; // forced to hit d and f files
    } else {
      pos[pickRandom(['e1', 'e2', 'd1', 'd2'])] = 'wK';
    };

    if (pos['a5'] || pos['b5']) {
      if (pos['e1'] || pos['e2']) {
        pos['b2'] = 'wK'; // forced to hit SW and c file and 3 rank
      } else {
        pos[pickRandom(['a2', 'b2'])] = 'wK'; // forced to hit SW and 3 rank
      }
    } else {
      if (pos['e1'] || pos['e2']) {
        pos[pickRandom(['b1', 'b2'])] = 'wK'; // forced to hit SW and c file
      } else {
        pos[pickRandom(['a1', 'b1', 'a2', 'b2'])] = 'wK'; // just hit SW
      }
    };

    const posFEN = objToFen(pos);
    const symmetries = getSymmetries(posFEN);

    return fenToObj(pickRandom(symmetries));
  }
};

const solveQueen = () => {
  if (gameMode === 'MAX') {
    return pickRandom([
      '3Q4/1Q6/6Q1/2Q5/5Q2/7Q/4Q3/Q7',
      '4Q3/1Q6/3Q4/6Q1/2Q5/7Q/5Q2/Q7',
      '2Q5/4Q3/1Q6/7Q/5Q2/3Q4/6Q1/Q7',
      '2Q5/5Q2/3Q4/1Q6/7Q/4Q3/6Q1/Q7',
      '4Q3/6Q1/Q7/2Q5/7Q/5Q2/3Q4/1Q6',
      '3Q4/5Q2/7Q/2Q5/Q7/6Q1/4Q3/1Q6',
      '2Q5/5Q2/7Q/Q7/3Q4/6Q1/4Q3/1Q6',
      '4Q3/2Q5/7Q/3Q4/6Q1/Q7/5Q2/1Q6',
      '4Q3/6Q1/3Q4/Q7/2Q5/7Q/5Q2/1Q6',
      '3Q4/Q7/4Q3/7Q/5Q2/2Q5/6Q1/1Q6',
      '2Q5/5Q2/3Q4/Q7/7Q/4Q3/6Q1/1Q6',
      '3Q4/6Q1/4Q3/2Q5/Q7/5Q2/7Q/1Q6',
      '5Q2/3Q4/1Q6/7Q/4Q3/6Q1/Q7/2Q5',
      '5Q2/3Q4/6Q1/Q7/7Q/1Q6/4Q3/2Q5',
      'Q7/6Q1/3Q4/5Q2/7Q/1Q6/4Q3/2Q5',
      '5Q2/7Q/1Q6/3Q4/Q7/6Q1/4Q3/2Q5',
      '5Q2/1Q6/6Q1/Q7/3Q4/7Q/4Q3/2Q5',
      '3Q4/6Q1/Q7/7Q/4Q3/1Q6/5Q2/2Q5',
      '4Q3/7Q/3Q4/Q7/6Q1/1Q6/5Q2/2Q5',
      '3Q4/7Q/Q7/4Q3/6Q1/1Q6/5Q2/2Q5',
      '1Q6/6Q1/4Q3/7Q/Q7/3Q4/5Q2/2Q5',
      'Q7/6Q1/4Q3/7Q/1Q6/3Q4/5Q2/2Q5',
      '1Q6/4Q3/6Q1/3Q4/Q7/7Q/5Q2/2Q5',
      '3Q4/1Q6/6Q1/4Q3/Q7/7Q/5Q2/2Q5',
      '4Q3/6Q1/Q7/3Q4/1Q6/7Q/5Q2/2Q5',
      '5Q2/3Q4/Q7/4Q3/7Q/1Q6/6Q1/2Q5',
      '4Q3/Q7/3Q4/5Q2/7Q/1Q6/6Q1/2Q5',
      '4Q3/1Q6/5Q2/Q7/6Q1/3Q4/7Q/2Q5',
      '5Q2/2Q5/6Q1/1Q6/7Q/4Q3/Q7/3Q4',
      '1Q6/6Q1/2Q5/5Q2/7Q/4Q3/Q7/3Q4',
      '6Q1/2Q5/Q7/5Q2/7Q/4Q3/1Q6/3Q4',
      '4Q3/Q7/7Q/5Q2/2Q5/6Q1/1Q6/3Q4',
      'Q7/4Q3/7Q/5Q2/2Q5/6Q1/1Q6/3Q4',
      '2Q5/5Q2/7Q/Q7/4Q3/6Q1/1Q6/3Q4',
      '5Q2/2Q5/Q7/6Q1/4Q3/7Q/1Q6/3Q4',
      '6Q1/4Q3/2Q5/Q7/5Q2/7Q/1Q6/3Q4',
      '6Q1/2Q5/7Q/1Q6/4Q3/Q7/5Q2/3Q4',
      '4Q3/2Q5/Q7/6Q1/1Q6/7Q/5Q2/3Q4',
      '1Q6/4Q3/6Q1/Q7/2Q5/7Q/5Q2/3Q4',
      '2Q5/5Q2/1Q6/4Q3/7Q/Q7/6Q1/3Q4',
      '5Q2/Q7/4Q3/1Q6/7Q/2Q5/6Q1/3Q4',
      '7Q/2Q5/Q7/5Q2/1Q6/4Q3/6Q1/3Q4',
      '1Q6/7Q/5Q2/Q7/2Q5/4Q3/6Q1/3Q4',
      '4Q3/6Q1/1Q6/5Q2/2Q5/Q7/7Q/3Q4',
      '2Q5/5Q2/1Q6/6Q1/4Q3/Q7/7Q/3Q4',
      '5Q2/1Q6/6Q1/Q7/2Q5/4Q3/7Q/3Q4',
      '2Q5/6Q1/1Q6/7Q/5Q2/3Q4/Q7/4Q3',
      '5Q2/2Q5/6Q1/1Q6/3Q4/7Q/Q7/4Q3',
      '3Q4/1Q6/6Q1/2Q5/5Q2/7Q/Q7/4Q3',
      '6Q1/Q7/2Q5/7Q/5Q2/3Q4/1Q6/4Q3',
      'Q7/5Q2/7Q/2Q5/6Q1/3Q4/1Q6/4Q3',
      '2Q5/7Q/3Q4/6Q1/Q7/5Q2/1Q6/4Q3',
      '5Q2/2Q5/6Q1/3Q4/Q7/7Q/1Q6/4Q3',
      '6Q1/3Q4/1Q6/7Q/5Q2/Q7/2Q5/4Q3',
      '3Q4/5Q2/7Q/1Q6/6Q1/Q7/2Q5/4Q3',
      '1Q6/5Q2/Q7/6Q1/3Q4/7Q/2Q5/4Q3',
      '1Q6/3Q4/5Q2/7Q/2Q5/Q7/6Q1/4Q3',
      '2Q5/5Q2/7Q/1Q6/3Q4/Q7/6Q1/4Q3',
      '5Q2/2Q5/Q7/7Q/3Q4/1Q6/6Q1/4Q3',
      '7Q/3Q4/Q7/2Q5/5Q2/1Q6/6Q1/4Q3',
      '3Q4/7Q/Q7/2Q5/5Q2/1Q6/6Q1/4Q3',
      '1Q6/5Q2/7Q/2Q5/Q7/3Q4/6Q1/4Q3',
      '6Q1/1Q6/5Q2/2Q5/Q7/3Q4/7Q/4Q3',
      '2Q5/5Q2/1Q6/6Q1/Q7/3Q4/7Q/4Q3',
      '3Q4/6Q1/2Q5/7Q/1Q6/4Q3/Q7/5Q2',
      '3Q4/7Q/4Q3/2Q5/Q7/6Q1/1Q6/5Q2',
      '2Q5/4Q3/7Q/3Q4/Q7/6Q1/1Q6/5Q2',
      '3Q4/1Q6/7Q/4Q3/6Q1/Q7/2Q5/5Q2',
      '4Q3/6Q1/1Q6/3Q4/7Q/Q7/2Q5/5Q2',
      '6Q1/3Q4/1Q6/4Q3/7Q/Q7/2Q5/5Q2',
      '7Q/1Q6/3Q4/Q7/6Q1/4Q3/2Q5/5Q2',
      '6Q1/1Q6/3Q4/Q7/7Q/4Q3/2Q5/5Q2',
      '4Q3/Q7/7Q/3Q4/1Q6/6Q1/2Q5/5Q2',
      '3Q4/Q7/4Q3/7Q/1Q6/6Q1/2Q5/5Q2',
      '4Q3/1Q6/7Q/Q7/3Q4/6Q1/2Q5/5Q2',
      '2Q5/6Q1/1Q6/7Q/4Q3/Q7/3Q4/5Q2',
      '2Q5/Q7/6Q1/4Q3/7Q/1Q6/3Q4/5Q2',
      '7Q/1Q6/4Q3/2Q5/Q7/6Q1/3Q4/5Q2',
      '2Q5/4Q3/1Q6/7Q/Q7/6Q1/3Q4/5Q2',
      '2Q5/4Q3/6Q1/Q7/3Q4/1Q6/7Q/5Q2',
      '4Q3/1Q6/3Q4/5Q2/7Q/2Q5/Q7/6Q1',
      '5Q2/2Q5/4Q3/7Q/Q7/3Q4/1Q6/6Q1',
      '4Q3/7Q/3Q4/Q7/2Q5/5Q2/1Q6/6Q1',
      '3Q4/1Q6/4Q3/7Q/5Q2/Q7/2Q5/6Q1',
      '3Q4/5Q2/Q7/4Q3/1Q6/7Q/2Q5/6Q1',
      '5Q2/2Q5/Q7/7Q/4Q3/1Q6/3Q4/6Q1',
      '4Q3/2Q5/Q7/5Q2/7Q/1Q6/3Q4/6Q1',
      '3Q4/1Q6/7Q/5Q2/Q7/2Q5/4Q3/6Q1',
      '5Q2/2Q5/4Q3/6Q1/Q7/3Q4/1Q6/7Q',
      '5Q2/3Q4/6Q1/Q7/2Q5/4Q3/1Q6/7Q',
      '3Q4/6Q1/4Q3/1Q6/5Q2/Q7/2Q5/7Q',
      '4Q3/6Q1/1Q6/5Q2/2Q5/Q7/3Q4/7Q',
    ])
  } else {
    // TODO get all unique
    // 65 unique https://www.pleacher.com/mp/puzzles/miscpuz3/queens5.html
    return pickRandom([
      '6Q1/2Q5/8/8/7Q/3Q4/8/Q7',
      '6Q1/8/1Q6/8/4Q3/7Q/8/3Q4',
      '8/8/3Q4/6Q1/4Q3/2Q5/5Q2/8',
      '6Q1/8/4Q3/3Q4/2Q5/8/Q7/8'
    ].flatMap(i => getSymmetries(i)));
  }
};

const solveRook = () => {
  let pos = {};
  if (gameMode === 'MAX') {
    shuffle(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
      .forEach((v, i) => pos[v + (i + 1)] = 'wR')
  } else {
    for (let i = 1; i <= 8; i++) {
      const rand = pickRandom([1, 2, 3, 4, 5, 6, 7, 8]);
      pos[letter(i) + rand] = 'wR';
    }
    pos = pickRandom([pos, fenToObj(transpose(objToFen(pos)))]);
  }
  return pos;
};

const solveBishop = () => {
  if (gameMode === 'MAX') {
    let pos = {};

    // Corners are independent
    pos[pickRandom(['a1', 'h8'])] = 'wB';
    pos[pickRandom(['a8', 'h1'])] = 'wB';

    // Edges must swap
    for (let i = 2; i <= 7; i++) {
      pickRandom([
        ['a' + i, 'h' + (9 - i)],
        [letter(i) + 1, letter(9 - i) + 8]
      ]).forEach(v => pos[v] = 'wB');
    }
    return pos;
  } else {
    return pickRandom([
      '3B4/3B4/3B4/3B4/3B4/3B4/3B4/3B4',
      '4B3/4B3/4B3/4B3/4B3/4B3/4B3/4B3',
      '8/8/8/BBBBBBBB/8/8/8/8',
      '8/8/8/8/BBBBBBBB/8/8/8'
      // TODO add perturbations, e.g.
      // swapping corners of a tilted rectangle
      // using d/e or 4/5 a reflection axis
      // '8/3BB3/8/3BB3/8/3BB3/8/3BB3'
      // '8/8/2BBBB2/8/8/2BBBB2/8/8'
      // '8/8/2BB1B2/5B2/2B5/2B1BB2/8/8'
      // '8/8/2BB1B2/5B2/2B5/4B3/8/3BB3'
      // '3B4/8/8/2BB1B2/B4B2/2B5/4B3/8'
      // '8/3BB3/1B4B1/8/2B2B2/2B2B2/8/8'
      // '8/3B4/8/3B4/1B1B1B1B/3B4/8/3B4'
      // '3B4/8/2B1B3/4B2B/1B6/3BB3/8/8'
    ]);
  }
};

const solveKnight = () => {
  if (gameMode === 'MAX') {
    return pickRandom([
      'N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N',
      '1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1',
    ])
  } else {
    return pickRandom([
      '8/5N2/1NN1NN2/2N5/5N2/2NN1NN1/2N5/8',
      '8/2N5/2NN1NN1/5N2/2N5/1NN1NN2/5N2/8',
    ]);
  }
};

const solvePawn = () => {
  if (gameMode === 'MAX') {
    return pickRandom([
      'PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP/8',
      'PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP/8/8/PPPPPPPP',
      'PPPPPPPP/8/PPPPPPPP/8/8/PPPPPPPP/8/PPPPPPPP',
      'PPPPPPPP/8/8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP',
      '8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP',
      'P1P1P1P1/P1P1P1P1/P1P1P1P1/P1P1P1P1/P1P1P1P1/P1P1P1P1/P1P1P1P1/P1P1P1P1',
      'P1P1P2P/P1P1P2P/P1P1P2P/P1P1P2P/P1P1P2P/P1P1P2P/P1P1P2P/P1P1P2P',
      'P1P2P1P/P1P2P1P/P1P2P1P/P1P2P1P/P1P2P1P/P1P2P1P/P1P2P1P/P1P2P1P',
      'P2P1P1P/P2P1P1P/P2P1P1P/P2P1P1P/P2P1P1P/P2P1P1P/P2P1P1P/P2P1P1P',
      '1P1P1P1P/1P1P1P1P/1P1P1P1P/1P1P1P1P/1P1P1P1P/1P1P1P1P/1P1P1P1P/1P1P1P1P',
      // TODO add perturbations
    ]);
  } else {
    return '8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP/8/PPPPPPPP';
  }
};

const solve = piece => {
  switch (piece) {
    case 'king':
      return solveKing();
    case 'queen':
      return solveQueen();
    case 'rook':
      return solveRook();
    case 'bishop':
      return solveBishop();
    case 'knight':
      return solveKnight();
    case 'pawn':
      return solvePawn();
    default:
      return {};
  };
};

document.querySelector('#modeSwitch').addEventListener('change', () => {
  gameMode = document.querySelector('#modeSwitch').checked ? 'MIN' : 'MAX';

  // Update Possible Scores
  const possible = scores[gameMode];
  document.querySelector('#kingPossible').textContent = possible['K']['wr'];
  document.querySelector('#queenPossible').textContent = possible['Q']['wr'];
  document.querySelector('#rookPossible').textContent = possible['R']['wr'];
  document.querySelector('#bishopPossible').textContent = possible['B']['wr'];
  document.querySelector('#knightPossible').textContent = possible['N']['wr'];
  document.querySelector('#pawnPossible').textContent = possible['P']['wr'];

  updateStats(board.position);
});

for (let piece of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
  document.querySelector(`#${piece}Btn`)
    .addEventListener('click', () => board.setPosition(solve(piece)));
}

clearBtn.addEventListener('click', () => board.clear());
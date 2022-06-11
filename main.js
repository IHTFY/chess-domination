import { objToFen, fenToObj } from 'https://unpkg.com/chessboard-element@1.2.0/lib/chessboard-element.js?module';

/** GLOBAL VARIABLES */
let gameMode = 'MAX';

const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};


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

const updateStats = (pos, oldPos) => {
  const pieceCount = Object.values(pos).reduce((a, c) => {
    a[c[1]]++;
    return a;
  }, { 'K': 0, 'Q': 0, 'R': 0, 'B': 0, 'N': 0, 'P': 0 });
  stats.innerHTML = Object.entries(pieceCount).map(([k, v]) => `${{
    'K': '♔',
    'Q': '♕',
    'R': '♖',
    'B': '♗',
    'N': '♘',
    'P': '♙',
  }[k]}: ${v}`).join('<br>');
};

board.addEventListener('change', e => {
  const { value, oldValue } = e.detail;
  updateStats(value, oldValue);
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
    return pickRandom(getSymmetries('6Q1/2Q5/8/8/7Q/3Q4/8/Q7'));
  }
};

const solveRook = () => {
  let pos = {};
  shuffle(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    .forEach((v, i) => pos[v + (i + 1)] = 'wR')
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

document.querySelector('#modeSwitch').addEventListener('change', () => gameMode = document.querySelector('#modeSwitch').checked ? 'MIN' : 'MAX');

for (let piece of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
  document.querySelector(`#${piece}Btn`)
    .addEventListener('click', () => board.setPosition(solve(piece)));
}

clearBtn.addEventListener('click', () => board.clear());
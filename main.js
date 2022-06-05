const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const letter = i => String.fromCharCode(96 + i);
const index = l => l.charCodeAt(0) - 96;

const board = document.querySelector('#board');
board.sparePieces = true;
board.draggablePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `https://lichess1.org/assets/_a8WL5z/piece/alpha/${piece}.svg`;

let KINGS = [];

const updateStats = (pos, oldPos) => stats.textContent = JSON.stringify(Object.values(pos).reduce((a, c) => {
  a[c[1]]++;
  return a;
}, { 'K': 0, 'Q': 0, 'R': 0, 'B': 0, 'N': 0, 'P': 0 }));

board.addEventListener('change', e => {
  const { value, oldValue } = e.detail;
  updateStats(value, oldValue);
});

// Solve For Kings
const solveKings = () => {
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
    pickRandom([j, j, j + 1])
  ];

  // for each 2x2 subsquare
  // a1, a2, b1, b2
  for (let i = 97; i <= 104; i += 2) {
    for (let j = 1; j <= 8; j += 2) {
      let [x, y] = randomSub(i, j);
      while (hasNeighbor(pos, x, y)) {
        [x, y] = randomSub(i, j);
      }
      pos[String.fromCharCode(x) + y] = 'wK';
    }
  }

  return pos;
};

// Solve For Queens
const solveQueens = () => {
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
  ]);
};

// Solve For Rooks
const solveRooks = () => {
  let pos = {};
  shuffle(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    .forEach((v, i) => pos[v + (i + 1)] = 'wR')
  return pos;
};

// Solve For Bishops
const solveBishops = () => {
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
};

// Solve For Knights
const solveKnights = () => pickRandom([
  'N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N',
  '1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1/1N1N1N1N/N1N1N1N1',
]);

// Solve For Pawns
const solvePawns = () => {
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
};


document.querySelector('#kingBtn').addEventListener('click', () => board.setPosition(solveKings()));
document.querySelector('#queenBtn').addEventListener('click', () => board.setPosition(solveQueens()));
document.querySelector('#rookBtn').addEventListener('click', () => board.setPosition(solveRooks()));
document.querySelector('#bishopBtn').addEventListener('click', () => board.setPosition(solveBishops()));
document.querySelector('#knightBtn').addEventListener('click', () => board.setPosition(solveKnights()));
document.querySelector('#pawnBtn').addEventListener('click', () => board.setPosition(solvePawns()));

clearBtn.addEventListener('click', () => board.clear());
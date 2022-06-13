import { objToFen, fenToObj } from 'https://unpkg.com/chessboard-element@1.2.0/lib/chessboard-element.js?module';
import {
  pickRandom,
  shuffle,
  letter,
  transpose,
  getSymmetries,
} from './utils.js';


/** Solutions */
const solveKing = mode => {
  if (mode === 'MAX') {
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

const solveQueen = mode => {
  if (mode === 'MAX') {
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
      '6Q1/8/4Q3/3Q4/2Q5/8/Q7/8',
      '8/2Q5/8/6Q1/3Q4/Q7/8/4Q3',
      '7Q/8/3Q4/Q7/8/5Q2/8/2Q5'
    ].flatMap(i => getSymmetries(i)));
  }
};

const solveRook = mode => {
  let pos = {};
  if (mode === 'MAX') {
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

const solveBishop = mode => {
  if (mode === 'MAX') {
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
      '8/8/8/8/BBBBBBBB/8/8/8',
      // TODO add perturbations, e.g.
      // Almost any 2 can be swapped with their intersections, but some have corners oob?
      // If bishops share a diagonal, xeither can be moved along the anti-diagonal (common diagonal is redundant)
      // Black and white operate independently
      // There must be a bishop on each long diag since the corer can't be hit from the other direction
      // Perhaps needs to be c6-f3? Corner and 1 away don't seem to work - need to check
      // You can use any permutation of 1-4 on the 4x4 grid for a color
      '8/3BB3/8/3BB3/8/3BB3/8/3BB3',
      '8/8/2BBBB2/8/8/2BBBB2/8/8',
      '8/8/2BB1B2/5B2/2B5/2B1BB2/8/8',
      '8/8/2BB1B2/5B2/2B5/4B3/8/3BB3',
      '3B4/8/8/2BB1B2/B4B2/2B5/4B3/8',
      '8/3BB3/1B4B1/8/2B2B2/2B2B2/8/8',
      '8/3B4/8/3B4/1B1B1B1B/3B4/8/3B4',
      '3B4/8/2B1B3/4B2B/1B6/3BB3/8/8',
    ]);
  }
};

const solveKnight = mode => {
  if (mode === 'MAX') {
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

const solvePawn = mode => {
  if (mode === 'MAX') {
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

const solve = (piece, mode) => {
  switch (piece) {
    case 'king':
      return solveKing(mode);
    case 'queen':
      return solveQueen(mode);
    case 'rook':
      return solveRook(mode);
    case 'bishop':
      return solveBishop(mode);
    case 'knight':
      return solveKnight(mode);
    case 'pawn':
      return solvePawn(mode);
    default:
      return {};
  };
};

export { solve };
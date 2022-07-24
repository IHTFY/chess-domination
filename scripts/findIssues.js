import { letter, index, countPieces } from './utils.js';

/**
 * Returns whether the board is empty or not
 * @param {object} pos the board position
 * @returns {boolean} `true` if there are no pieces on the board
 */
const isEmpty = (pos) => Object.keys(pos).length === 0;

/**
 * Returns an array of piece types on the board. e.g. ['B', 'K']
 * @param {object} pos the board position
 * @returns {[string]} an array of pieces on the board
 */
const presentPieces = pos => {
  const pieceCount = countPieces(pos);
  return Object.entries(pieceCount).filter(i => i[1] > 0).map(i => i[0])
};

/**
 * Returns an array of pieces, sorted by highest quantity, excluding the mode. e.g ['B', 'K', 'Q', 'N', 'P']
 * Ties are broken arbitrarily
 * @param {object} pos the board position
 * @returns an array of pieces excluding the most common piece
 */
const minorityPieces = pos => Object.entries(countPieces(pos)).sort((a, b) => b[1] - a[1]).slice(1).reduce((a, c) => [...a, c[0]], []);


/**
 * Returns whether squares `a` and `b` can be attacked if occupied by the given piece type.
 * @param {string} pieceType e.g. 'K'
 * @param {string} a e.g. 'b2'
 * @param {string} b e.g. 'c1'
 * @returns {boolean} e.g. `true` because a king on `c1` can attack `b2` and vice versa
 */
const attacking = (pieceType, a, b) => {
  const dx = Math.abs(index(a) - index(b));
  const dy = Math.abs(a[1] - b[1]);
  switch (pieceType) {
    case 'K': return dx < 2 && dy < 2;
    case 'Q': return dx === 0 || dy === 0 || dx === dy || dx === -dy;
    case 'R': return dx === 0 || dy === 0;
    case 'B': return dx === dy || dx === -dy;
    case 'N': return (dx === 2 && dy === 1) || (dx === 1 & dy === 2);
    case 'P': return dx === 1 && dy === 1;
    default: return false;
  }
};


// Check if board position is valid solution for the current game mode
/**
 * Returns an array of squares which have an issue. Used to highlight squares: either uncovered squares, or attacking pieces.
 * @param {object} pos the board position
 * @param {'MAX' | 'MIN'} mode the gameMode
 * @returns {[string]} an array of squares which make the position an invalid solution for the given gameMode
 */
const findIssues = (pos, mode) => {
  const occupied = Object.keys(pos);

  const pieces = presentPieces(pos);

  // check for mixed pieces 
  if (pieces.length > 1) {
    const minority = minorityPieces(pos);
    return Object.entries(pos).filter(square => minority.includes(square[1][1])).reduce((a, c) => [...a, c[0]], []);
  }

  const pieceType = pieces[0];


  if (mode === 'MAX') {
    // check for attacking pieces
    let interference = new Set();
    for (let i = 0; i < occupied.length - 1; i++) {
      for (let j = i + 1; j < occupied.length; j++) {
        if (attacking(pieceType, occupied[i], occupied[j])) {
          interference.add(occupied[i]).add(occupied[j]);
        }
      }
    }
    return [...interference];
  } else {
    // check for uncovered squares
    let uncovered = [];
    for (let i = 1; i <= 8; i++) {
      for (let j = 1; j <= 8; j++) {
        const testSquare = letter(i) + j;
        if (occupied.some(piece => attacking(pieceType, testSquare, piece) || piece === testSquare)) {
          continue;
        } else {
          uncovered.push(testSquare);
        }
      }
    }
    return uncovered;
  }
};

export { isEmpty, findIssues };
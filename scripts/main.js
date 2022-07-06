// remove black pieces
document.querySelector('#board').shadowRoot.querySelector('[part=spare-pieces]').remove();

import { full, countPieces } from './utils.js';
import { solve } from './solver.js';
import { isValid } from './isValid.js';

const defaultScores = {
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

/** GLOBAL VARIABLES */
let gameMode = localStorage.getItem('gameMode') ?? 'MAX';
let scores = JSON.parse(localStorage.getItem('scores')) ?? defaultScores;

const syncData = () => {
  localStorage.setItem('gameMode', gameMode);
  localStorage.setItem('scores', JSON.stringify(scores));
};

const pieces = Object.keys(scores[gameMode]);

const board = document.querySelector('#board');
board.sparePieces = true;
board.draggablePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `/svg/${piece}.svg`;


const updateStats = pos => {
  const pieceCount = countPieces(pos);

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
  for (let p of pieces) {
    document.querySelector(`#${full(p)}Best`).textContent = scores[gameMode][p]['pb'];
    document.querySelector(`#${full(p)}Count`).textContent = pieceCount[p];
  }

  // save to localStorage
  syncData();
};

board.addEventListener('change', e => {
  const { value, oldValue } = e.detail;
  updateStats(value);
});


// initialize board based on saved Best values
updateStats(board.position);

// initialize, based on localStorage
const modeSwitch = document.querySelector('#modeSwitch');
modeSwitch.checked = gameMode === 'MIN';
modeSwitch.addEventListener('change', () => {
  gameMode = modeSwitch.checked ? 'MIN' : 'MAX';
  syncData();

  // Update Possible Scores
  const possible = scores[gameMode];
  for (let p of pieces) {
    document.querySelector(`#${full(p)}Possible`).textContent = possible[p]['wr'];
  }

  updateStats(board.position);
});

for (let piece of pieces.map(p => full(p))) {
  document.querySelector(`#${piece}Btn`)
    .addEventListener('click', () => board.setPosition(solve(piece, gameMode)));
}

clearBtn.addEventListener('click', () => board.clear());
resetBtn.addEventListener('click', () => {
  scores = defaultScores;
  syncData();
  updateStats(board.position);
});

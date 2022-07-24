const soundSwitch = document.querySelector('#soundSwitch');
soundSwitch.checked = JSON.parse(localStorage.getItem('soundMode')) ?? true;

const highlightSwitch = document.querySelector('#highlightSwitch');
highlightSwitch.checked = JSON.parse(localStorage.getItem('hilight')) ?? true;



let index = 0;
const clicks = [...Array(7)].map((_, i) => new Audio(`sounds/click${i + 1}.mp3`));
const beeps = (new Audio('sounds/beeps.mp3'))
beeps.volume = 0.3;

const numberAnimationDuration = n => [...document.querySelectorAll('.animated-number')].forEach(el => el.style.setProperty('--beeps-duration', n));

// remove black pieces
document.querySelector('#board').shadowRoot.querySelector('[part=spare-pieces]').remove();

import { full, countPieces, isEmpty } from './utils.js';
import { solve } from './solver.js';
import { findIssues } from './findIssues.js';
import { clearHighlights, highlight } from './highlighter.js';

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
let scores = JSON.parse(localStorage.getItem('scores')) ?? structuredClone(defaultScores);

/** GLOBAL CONSTANTS */
const pieces = Object.keys(scores[gameMode]);

const board = document.querySelector('#board');
board.sparePieces = true;
board.draggablePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `/svg/${piece}.svg`;


// Store data in localStorage
const syncData = () => {
  localStorage.setItem('gameMode', gameMode);
  localStorage.setItem('scores', JSON.stringify(scores));
};

// Update table to match stats
const syncTable = (pos) => {
  const pieceCount = countPieces(pos);
  for (let p of pieces) {
    const wr = parseInt(scores[gameMode][p]['wr']);
    const pb = parseInt(scores[gameMode][p]['pb']);
    const diff = Math.abs(wr - pb);

    document.querySelector(`#${full(p)}Count`).style.setProperty('--num', parseInt(pieceCount[p]));
    document.querySelector(`#${full(p)}Best`).style.setProperty('--num', pb);
    document.querySelector(`#${full(p)}Diff`).style.setProperty('--num', diff);
    document.querySelector(`#${full(p)}Possible`).style.setProperty('--num', wr);

    const diffRatio = Math.abs(pb - wr) / Math.max(pb, wr);
    const diffScaled = Math.min(Math.max(Math.floor(255 * (1 - diffRatio)), 0), 255)
    const diffColor = diffScaled.toString(16).padStart(2, '0');

    document.querySelector(`#${full(p)}Diff`).style.color = `#FF${diffColor.repeat(2)}`;
  }
};

// check the board and update the score and table
const updateStats = pos => {
  const pieceCount = countPieces(pos);
  const pieceType = Object.values(pos)[0]?.[1];
  const issues = findIssues(pos, gameMode);

  // default white text
  document.querySelectorAll('[id*=Count]').forEach(e => e.style.color = '#FFFFFF');
  // make text green if valid and red if not
  if (pieceType) {
    document.querySelector(`#${full(pieceType)}Count`).style.color = issues.length === 0 ? '#00FF00' : '#FF0000';
  };

  clearHighlights();

  // Update the personal best
  if (issues.length === 0 && !isEmpty(pos)) {
    scores[gameMode][pieceType]['pb'] = Math[gameMode.toLowerCase()](scores[gameMode][pieceType]['pb'], pieceCount[pieceType]);
  } else {
    if (highlightSwitch.checked) highlight(issues);
  }

  syncTable(pos);
  syncData();
};

board.addEventListener('change', e => {
  const { value, oldValue } = e.detail;
  if (soundSwitch.checked) {
    if (Object.keys(value)?.length >= Object.keys(oldValue)?.length) {
      clicks[index++ % clicks.length].play()
    }
  }
  updateStats(value);
  syncTable(value);
});


syncTable(board.position);

// initialize, based on localStorage
const modeSwitch = document.querySelector('#modeSwitch');
modeSwitch.checked = gameMode === 'MIN';

// initialize Possible Scores
for (let p of pieces) {
  document.querySelector(`#${full(p)}Possible`).style.setProperty('--num', parseInt(scores[gameMode][p]['wr']));
}

soundSwitch.addEventListener('change', () => {
  localStorage.setItem('soundMode', JSON.stringify(soundSwitch.checked));
});

highlightSwitch.addEventListener('change', () => {
  localStorage.setItem('hilight', JSON.stringify(highlightSwitch.checked));
  highlightSwitch.checked ? updateStats(board.position) : clearHighlights();
});

modeSwitch.addEventListener('change', () => {
  gameMode = modeSwitch.checked ? 'MIN' : 'MAX';
  syncData();

  // Update Possible Scores
  for (let p of pieces) {
    document.querySelector(`#${full(p)}Possible`).style.setProperty('--num', parseInt(scores[gameMode][p]['wr']));
  }

  updateStats(board.position);
});

for (let piece of pieces.map(p => full(p))) {
  document.querySelector(`#${piece}Btn`)
    .addEventListener('click', () => board.setPosition(solve(piece, gameMode)));
}

clearBtn.addEventListener('click', () => board.clear());
resetBtn.addEventListener('click', () => {
  scores = structuredClone(defaultScores);
  syncData();
  syncTable(board.position);
  if (soundSwitch.checked) {
    numberAnimationDuration('1.5s');
    beeps.play();
    beeps.addEventListener('ended', () => numberAnimationDuration('0.2s'));
  }
});

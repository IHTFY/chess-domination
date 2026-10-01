import { defaultScores, readBoolean, readMode, readScores, writeStored } from './storage.js';
import { full, countPieces, isEmpty } from './utils.js';
import { solve } from './solver.js';
import { findIssues } from './findIssues.js';
import { clearHighlights, highlight } from './highlighter.js';

const soundSwitch = document.querySelector('#soundSwitch');
soundSwitch.checked = readBoolean('soundMode');

const highlightSwitch = document.querySelector('#highlightSwitch');
highlightSwitch.checked = readBoolean('hilight');

let index = 0;
const clicks = [...Array(7)].map((_, i) => new Audio(`sounds/click${i + 1}.mp3`));
const beeps = new Audio('sounds/beeps.mp3');
beeps.volume = 0.3;

const numberAnimationDuration = n => [...document.querySelectorAll('.animated-number')].forEach(el => el.style.setProperty('--beeps-duration', n));

let gameMode = readMode();
let scores = readScores();

/** GLOBAL CONSTANTS */
const pieces = Object.keys(scores[gameMode]);

const board = document.querySelector('#board');
await customElements.whenDefined('chess-board');
await board.updateComplete;
// Hide the black spare pieces after the component has rendered.
board.shadowRoot.querySelector('[part=spare-pieces]')?.remove();
// Overlay the drag layer instead of reserving an empty row below the board.
const boardStyle = document.createElement('style');
boardStyle.textContent = '#dragged-pieces { position: absolute; top: 0; left: 0; }';
board.shadowRoot.append(boardStyle);
board.sparePieces = true;
board.draggablePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `svg/${piece}.svg`;

// Store data in localStorage
const syncData = () => {
  writeStored('gameMode', gameMode);
  writeStored('scores', JSON.stringify(scores));
};

const playSound = (audio, onFailure = () => {}) => {
  audio.play().catch(onFailure);
};
beeps.addEventListener('ended', () => numberAnimationDuration('0.2s'));

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
    const diffScaled = Math.min(Math.max(Math.floor(255 * (1 - diffRatio)), 0), 255);
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
      playSound(clicks[index++ % clicks.length]);
    }
  }
  updateStats(value);
});

syncTable(board.position);

// initialize, based on localStorage
const modeSwitch = document.querySelector('#modeSwitch');
modeSwitch.checked = gameMode === 'MIN';

soundSwitch.addEventListener('change', () => {
  writeStored('soundMode', JSON.stringify(soundSwitch.checked));
});

highlightSwitch.addEventListener('change', () => {
  writeStored('hilight', JSON.stringify(highlightSwitch.checked));
  highlightSwitch.checked ? updateStats(board.position) : clearHighlights();
});

modeSwitch.addEventListener('change', () => {
  gameMode = modeSwitch.checked ? 'MIN' : 'MAX';
  updateStats(board.position);
});

for (let piece of pieces.map(p => full(p))) {
  document.querySelector(`#${piece}Btn`)
    .addEventListener('click', () => board.setPosition(solve(piece, gameMode)));
}

// On small screens the score table opens as a popup.
const app = document.querySelector('#app');
const statsBtn = document.querySelector('#statsBtn');
const setStatsOpen = open => {
  app.classList.toggle('stats-open', open);
  statsBtn.setAttribute('aria-expanded', open);
};
statsBtn.addEventListener('click', () => setStatsOpen(true));
document.querySelector('#statsClose').addEventListener('click', () => setStatsOpen(false));
document.querySelector('#statsBackdrop').addEventListener('click', () => setStatsOpen(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') setStatsOpen(false);
});

document.querySelector('#clearBtn').addEventListener('click', () => board.clear());
document.querySelector('#resetBtn').addEventListener('click', () => {
  scores = structuredClone(defaultScores);
  syncData();
  syncTable(board.position);
  if (soundSwitch.checked) {
    numberAnimationDuration('1.5s');
    playSound(beeps, () => numberAnimationDuration('0.2s'));
  }
});

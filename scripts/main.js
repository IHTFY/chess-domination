import { defaultScores, readBoolean, readMode, readScores, writeStored } from './storage.js';
import { full, countPieces, isEmpty } from './utils.js';
import { solve } from './solver.js';
import { findIssues } from './findIssues.js';
import { highlight } from './highlighter.js';
import { fenToObj, objToFen } from './chessboard-element.bundled.js';

const $ = id => document.getElementById(id);
const names = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
const pieces = Object.keys(names);
let selected = 'Q';
let gameMode = readMode();
let scores = readScores();
let sound = readBoolean('soundMode');
let hints = readBoolean('hilight');
let latestPosition = {};
let focusedSquare = 'a1';
let gesture = null;
let dragging = false;
let cancelDrop = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clicks = Array.from({ length: 7 }, (_, i) => new Audio(`sounds/click${i + 1}.mp3`));
const beeps = new Audio('sounds/beeps.mp3');
beeps.volume = 0.3;
let soundIndex = 0;

function playSound(audio, onFailure = () => {}) {
  if (!sound) return;
  audio.currentTime = 0;
  audio.play().catch(onFailure);
}

const board = $('board');
await customElements.whenDefined('chess-board');
await board.updateComplete;
board.draggablePieces = true;
board.sparePieces = true;
board.dropOffBoard = 'trash';
board.pieceTheme = piece => `svg/${piece}.svg`;
await board.updateComplete;

// Place the component's native spare-piece shelf in the control panel.
const boardStyle = document.createElement('style');
boardStyle.textContent = `
  #dragged-pieces { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 30; }
  :host [part='spare-pieces'] { display: none; }
  [part='board'] + [part='spare-pieces'] {
    display: grid; position: fixed; left: var(--tray-left); top: var(--tray-top);
    width: var(--tray-width); height: var(--tray-height); padding: 0;
    grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr); gap: 6px; z-index: 2;
  }
  [part='spare-pieces'] > div:not([id]) { display: none; }
  [id^='spare-w'] {
    box-sizing: border-box; display: grid; place-items: center; min-width: 0; min-height: 0;
    border: 1px solid #203554; background: #0e1b32; border-radius: 10px;
    padding: 6px; touch-action: none; cursor: grab;
  }
  [id^='spare-w'][aria-pressed='true'] { background: #193251; border-color: #6998dd; }
  [id^='spare-w'] [part~='piece'] { width: 100%; height: 100%; max-width: 32px; max-height: 32px; }
  [part~='piece'] img { -webkit-user-drag: none; }
  [data-square] { cursor: pointer; }
  [data-square]:has([piece]) { cursor: grab; }
  [data-square]:focus-visible, [id^='spare-w']:focus-visible { outline: 3px solid #78a8f6; outline-offset: -3px; }
`;
board.shadowRoot.append(boardStyle);

function positionTray() {
  const rect = $('pieceTray').getBoundingClientRect();
  for (const [key, value] of Object.entries({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })) {
    board.style.setProperty(`--tray-${key}`, `${value}px`);
  }
}
new ResizeObserver(positionTray).observe($('app'));
new ResizeObserver(positionTray).observe($('pieceTray'));
window.addEventListener('resize', positionTray);
positionTray();

function decorateBoard() {
  for (const piece of pieces) {
    const el = board.shadowRoot.getElementById(`spare-w${piece}`);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Place ${names[piece].toLowerCase()}`);
    el.setAttribute('aria-pressed', String(piece === selected));
    el.title = names[piece];
  }
  for (const el of board.shadowRoot.querySelectorAll('[data-square]')) {
    const square = el.dataset.square;
    const piece = latestPosition[square]?.[1];
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', square === focusedSquare ? '0' : '-1');
    el.setAttribute('aria-label', square + (piece ? `, ${names[piece]}` : ', empty'));
  }
}

function renderScores(pos) {
  const counts = countPieces(pos);
  $('score-goal').textContent = gameMode === 'MIN' ? 'Minimum' : 'Maximum';
  $('score-body').innerHTML = pieces.map(piece => {
    const { pb, wr } = scores[gameMode][piece];
    const hasRecord = gameMode === 'MIN' ? pb !== 64 : pb !== 0;
    const gap = hasRecord ? Math.abs(pb - wr) : 0;
    const description = !hasRecord ? 'No valid board recorded' : gap === 0 ? 'Matches optimal' : gameMode === 'MIN'
      ? `${gap} extra piece${gap === 1 ? '' : 's'} above the minimum`
      : `${gap} piece${gap === 1 ? '' : 's'} below the maximum`;
    const diff = gap > 0 ? `<span class="score-difference" aria-label="${description}">${gameMode === 'MIN' ? '+' : '−'}${gap}</span>` : '';
    return `<tr data-score-piece="${piece}" class="${piece === selected ? 'active-score' : ''}">
      <th scope="row">${names[piece]}</th><td id="${full(piece)}Count">${counts[piece]}</td>
      <td class="best-value ${gap > 0 ? 'off-optimal' : ''}" title="${description}"><span id="${full(piece)}Best">${hasRecord ? pb : '–'}</span>${diff}</td>
      <td>${wr}</td></tr>`;
  }).join('');
  $('scores-note').textContent = 'Valid boards only. ' + (gameMode === 'MIN'
    ? '+ means extra pieces above the minimum.' : '− means missing pieces below the maximum.');
}

function updateStats(pos) {
  latestPosition = pos;
  const counts = countPieces(pos);
  const types = pieces.filter(piece => counts[piece] > 0);
  const issues = findIssues(pos, gameMode);
  const valid = types.length === 1 && issues.length === 0;
  const count = Object.keys(pos).length;
  const target = scores[gameMode][selected].wr;
  if (valid && !isEmpty(pos)) {
    const piece = types[0];
    scores[gameMode][piece].pb = Math[gameMode.toLowerCase()](scores[gameMode][piece].pb, counts[piece]);
  }
  writeStored('gameMode', gameMode);
  writeStored('scores', JSON.stringify(scores));
  $('pieceCount').textContent = count;
  $('optimalCount').textContent = target;
  $('goal-label').textContent = gameMode === 'MIN' ? 'Minimum' : 'Maximum';
  const value = gameMode === 'MIN' ? (types.length > 1 ? 0 : 64 - issues.length) : count - issues.length;
  const total = gameMode === 'MIN' ? 64 : count;
  $('coveredCount').textContent = value;
  $('denominator').textContent = ` / ${total}`;
  $('coverage-label').textContent = gameMode === 'MIN' ? 'Covered' : 'Safe pieces';
  $('progress').style.width = `${total ? value / total * 100 : 0}%`;
  $('selected-name').textContent = names[selected];
  $('dominationBtn').setAttribute('aria-pressed', String(gameMode === 'MIN'));
  $('nonAttackingBtn').setAttribute('aria-pressed', String(gameMode === 'MAX'));
  $('highlightSwitch').setAttribute('aria-pressed', String(hints));
  $('highlightSwitch').setAttribute('aria-label', gameMode === 'MIN' ? 'Highlight uncovered squares' : 'Highlight attacking pieces');
  if (types.length > 1) $('hint').textContent = 'Use one piece type at a time.';
  else if (valid && count === target) $('hint').textContent = gameMode === 'MIN'
    ? 'Optimal solution. Every square is covered.' : 'Optimal solution. No pieces attack each other.';
  else if (valid && gameMode === 'MIN') $('hint').textContent = 'Every square is covered. Try using fewer pieces.';
  else if (gameMode === 'MAX' && issues.length) $('hint').textContent = 'Some pieces are attacking. Tap a piece to remove it.';
  else $('hint').textContent = `Tap or drag to place a ${names[selected].toLowerCase()}. Tap again to remove it.`;
  highlight(hints ? issues : [], gameMode);
  renderScores(pos);
  queueMicrotask(() => board.updateComplete.then(decorateBoard));
}

board.addEventListener('change', event => {
  playSound(clicks[soundIndex++ % clicks.length]);
  updateStats(event.detail.value);
});

function selectPiece(piece, clear = true) {
  if (selected === piece) return;
  selected = piece;
  if (clear) board.clear(false);
  updateStats(board.position);
}

function tapSquare(square) {
  const next = { ...board.position };
  if (next[square]) delete next[square];
  else next[square] = `w${selected}`;
  board.setPosition(next, false);
}

board.shadowRoot.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  const cell = event.target.closest('[data-square], [id^="spare-w"]');
  if (!cell) return;
  gesture = { element: cell, x: event.clientX, y: event.clientY, square: cell.dataset.square, occupied: Boolean(board.position[cell.dataset.square]), moved: false };
});
window.addEventListener('pointermove', event => {
  if (!gesture || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
  gesture.moved = true;
  if (!dragging && (gesture.occupied || gesture.element.id.startsWith('spare-w'))) {
    gesture.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: gesture.x, clientY: gesture.y }));
  }
}, { passive: true });
window.addEventListener('pointerup', event => {
  if (!gesture || dragging) return;
  const el = board.shadowRoot.elementFromPoint(event.clientX, event.clientY)?.closest('[data-square]');
  if (!gesture.moved) {
    if (gesture.element.id.startsWith('spare-w')) selectPiece(gesture.element.id.slice(-1));
    else if (el?.dataset.square === gesture.square) tapSquare(gesture.square);
  }
  gesture = null;
});
board.addEventListener('drag-start', event => {
  if (gesture && !gesture.moved) event.preventDefault();
  else dragging = true;
});
board.addEventListener('drop', event => {
  const { source, target, piece, setAction } = event.detail;
  if (cancelDrop) { setAction('snapback'); cancelDrop = false; }

  else if (source === 'spare' && target !== 'offboard' && piece[1] !== selected) selectPiece(piece[1]);
  dragging = false;
  gesture = null;
});

function cancelDrag() {
  if (!dragging) { gesture = null; return; }
  cancelDrop = true;
  // End the gesture through the component's existing drop/snapback path.
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: gesture?.x ?? 0, clientY: gesture?.y ?? 0 }));
}
window.addEventListener('touchcancel', cancelDrag);
window.addEventListener('blur', cancelDrag);
window.addEventListener('keydown', event => { if (event.key === 'Escape') cancelDrag(); });

board.shadowRoot.addEventListener('keydown', event => {
  const spare = event.target.closest('[id^="spare-w"]');
  const cell = event.target.closest('[data-square]');
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (spare) selectPiece(spare.id.slice(-1));
    else if (cell) tapSquare(cell.dataset.square);
  } else if (cell) {
    const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
    if (!offset) return;
    event.preventDefault();
    const file = cell.dataset.square.charCodeAt(0) + offset[0];
    const rank = Number(cell.dataset.square[1]) + offset[1];
    if (file < 97 || file > 104 || rank < 1 || rank > 8) return;
    focusedSquare = String.fromCharCode(file) + rank;
    decorateBoard();
    board.shadowRoot.getElementById(`square-${focusedSquare}`).focus();
  }
});

$('exampleBtn').addEventListener('click', () => {
  cancelDrag();
  let next;
  for (let attempt = 0; attempt < 24; attempt++) {
    const generated = solve(full(selected), gameMode);
    next = typeof generated === 'string' ? fenToObj(generated) : generated;
    if (objToFen(next) !== board.fen()) break;
  }
  board.setPosition(next, !reducedMotion.matches);
  $('exampleBtn').disabled = true;
  setTimeout(() => { $('exampleBtn').disabled = false; }, reducedMotion.matches ? 0 : 240);
});
$('clearBtn').addEventListener('click', () => { cancelDrag(); board.clear(false); });
for (const [id, mode] of [['dominationBtn', 'MIN'], ['nonAttackingBtn', 'MAX']]) {
  $(id).addEventListener('click', () => { cancelDrag(); gameMode = mode; updateStats(board.position); });
}
$('highlightSwitch').addEventListener('click', () => {
  hints = !hints;
  writeStored('hilight', JSON.stringify(hints));
  updateStats(board.position);
});
function syncSound() {
  $('soundSwitch').setAttribute('aria-pressed', String(sound));
  $('soundSwitch').title = sound ? 'Sound on' : 'Sound off';
}
$('soundSwitch').addEventListener('click', () => {
  sound = !sound;
  writeStored('soundMode', JSON.stringify(sound));
  syncSound();
  if (sound) playSound(clicks[soundIndex++ % clicks.length]);
});
$('statsBtn').addEventListener('click', () => {
  cancelDrag(); renderScores(board.position); $('statsPanel').showModal(); $('statsBtn').setAttribute('aria-expanded', 'true');
});
$('statsPanel').addEventListener('close', () => $('statsBtn').setAttribute('aria-expanded', 'false'));
$('aboutBtn').addEventListener('click', () => { cancelDrag(); $('instructions').showModal(); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
let resetTimer;
function finishResetSound() { clearTimeout(resetTimer); $('statsPanel').classList.remove('scores-resetting'); }
beeps.addEventListener('ended', finishResetSound);
$('resetBtn').addEventListener('click', () => {
  scores = structuredClone(defaultScores);
  writeStored('scores', JSON.stringify(scores));
  renderScores(board.position);
  if (sound) {
    $('statsPanel').classList.add('scores-resetting');
    resetTimer = setTimeout(finishResetSound, 2500);
    playSound(beeps, finishResetSound);
  }
});
for (const [id, occupied] of [['coverage-demo', [[1, 2]]], ['safe-demo', [[0, 3], [2, 0]]]]) {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cell = document.createElement('span');
    if ((x + y) % 2) cell.classList.add('dark');
    if (occupied.some(([a, b]) => a === x && b === y)) {
      cell.classList.add('example-piece');
      const img = document.createElement('img'); img.src = 'svg/wQ.svg'; img.alt = ''; cell.append(img);
    } else if (id === 'coverage-demo' && (x === 1 || y === 2 || Math.abs(x - 1) === Math.abs(y - 2))) cell.classList.add('controlled');
    $(id).append(cell);
  }
}
syncSound();
updateStats(board.position);
decorateBoard();

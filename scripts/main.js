import { defaultScores, readBoolean, readMode, readScores, writeStored } from './storage.js';
import { full, countPieces, isEmpty } from './utils.js';
import { solve } from './solver.js';
import { findIssues } from './findIssues.js';
import { highlight } from './highlighter.js';
import { fenToObj, objToFen } from './chessboard-element.bundled.js';

// ads:start
// The ads on the results screen and beside the board come from the shared IHTFY
// loader, which ihtfy.com serves for all the games (its source is in the
// IHTFY/com.ihtfy repo). Nothing ad-related loads before the player's first
// tap or key press: the loader arrives then if the window is wide enough for
// the ad beside the board, otherwise at the first solved board, and AdSense
// after it at browser idle. A visitor who may have bought ad-free gets no box
// and the loader at startup instead (loadForBuyer), so it can hide the ad box
// before the results screen shows.
//
// On a phone the results screen is the only screen with an ad. The play screen
// never has one, and the scores and instructions are dialogs, which never do.
const LOADER = 'https://ihtfy.com/ads/v1.js';

// The shared 300×250 display unit for the games' result screens.
const AD_SLOT = '6470163205';

// The games-play unit: 300×600 in AdSense; the 160×600 box uses it too.
const PLAY_AD_SLOT = '7239875855';

// A new game replaces the ad beside the board only once it has shown this long.
const PLAY_AD_MIN_MS = 60 * 1000;

let loader = null;

const load = () =>
  (loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = LOADER;
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => {
      script.remove();
      loader = null;
      reject(new Error('The ad loader did not load'));
    });
    document.head.appendChild(script);
  }));

/** Whether this browser holds an ad-free token, unchecked; the loader checks it. */
function mayBeAdFree() {
  let found = false;
  try {
    found = Boolean(localStorage.getItem('ihtfy-ad-free'));
  } catch {
    // Storage off: the cookie may still hold the token.
  }
  try {
    found ||= /(?:^|;\s*)ihtfy-ad-free=/.test(document.cookie);
  } catch {
    // Cookies off too: there is no token to find.
  }
  return found;
}

/** Loads the loader now if this browser holds an ad-free token. */
function loadForBuyer() {
  if (mayBeAdFree()) load().catch(() => {});
}

/** Fills `box` with an ad for the game over named `key`; offline or on failure it stays empty. Resolves to whether the loader was asked to place it. */
function showAd(box, key) {
  if (!navigator.onLine) return Promise.resolve(false);
  return load().then(
    () => {
      if (!box.isConnected) return false;
      window.ihtfyAds.show(box, key);
      return true;
    },
    () => false,
  );
}

// The screen that carries an ad on a phone.
const AD_SCREEN = 'results';

// The loader won't fill a box twice, so each ad gets a new, empty box.
function freshBox(box) {
  const next = box.cloneNode(false);
  box.replaceWith(next);
  return next;
}

/**
 * Puts a new box on the screen named `name` (whose element is `screen`, already
 * showing, so the stylesheet has sized the box) and fills it for the game over
 * named `key`. Any other screen gets nothing, and so does a visitor who may have
 * bought ad-free.
 */
function showScreenAd(name, screen, key) {
  if (name !== AD_SCREEN || document.documentElement.classList.contains('ad-free')) return;
  const box = freshBox(screen.querySelector('.ad-box'));
  box.removeAttribute('style'); // The last ad's size, kept for its own screen visit.
  const size = sizeOf(box);
  if (!size) return;
  box.dataset.adSize = size;
  // The loader's unit keeps this size, so the box does too if the window turns before the screen closes.
  const [width, height] = size.split('x');
  Object.assign(box.style, { width: `${width}px`, height: `${height}px`, minHeight: `${height}px` });
  showAd(box, key);
}

/** Swaps the box on a screen that is going away for an empty one, so no ad stays on the page out of view. */
function clearScreenAd(screen) {
  freshBox(screen.querySelector('.ad-box'));
}

// The player's first tap or key press.
const firstInput = new Promise(resolve => {
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, resolve, { once: true, capture: true });
});

let playBox = null;
let playSize = '';
let playKeys = 0;
// When the ad beside the board was placed; Infinity while its request is pending.
let playPlacedAt = -Infinity;

// The box's size as the stylesheet sets it, such as "160x600"; empty where the ad doesn't fit.
const sizeOf = box => (box.offsetWidth ? `${box.offsetWidth}x${box.offsetHeight}` : '');

// The loader won't fill a box twice, so each ad gets a new box. The old one
// goes even when the new one is hidden, so no ad stays on the page out of view.
function renewPlayAd() {
  const box = playBox.cloneNode(false);
  playBox.replaceWith(box);
  playBox = box;
  playSize = sizeOf(box);
  if (!playSize) return;
  box.dataset.adSize = playSize;
  playPlacedAt = Infinity;
  // The minute starts once the loader has been asked to place the ad; a failed
  // request frees the next game to try again.
  showAd(box, `play/${++playKeys}`).then(placed => {
    if (box === playBox) playPlacedAt = placed ? Date.now() : -Infinity;
  });
}

/** Fills `box`, beside the board, after the first tap or key press, and again whenever the window crosses into another ad size. */
function startPlayAd(box) {
  box.dataset.adSlot = PLAY_AD_SLOT;
  firstInput.then(() => {
    playBox = box;
    renewPlayAd();
    addEventListener('resize', () => {
      if (sizeOf(playBox) !== playSize) renewPlayAd();
    });
  });
}

/** A new game gets a new ad beside the board once the current one has shown for a minute. */
function newPlayAd() {
  if (playBox && Date.now() - playPlacedAt >= PLAY_AD_MIN_MS) renewPlayAd();
}

/**
 * Starts the ad beside the board. A visitor who may have bought ad-free starts
 * without it: the page's head script has already hidden the rail (the `ad-free`
 * class), so a buyer's game keeps the whole window from the first frame. The rail
 * comes back if the loader finds no valid token.
 */
function setUpPlayAd(rail) {
  const box = rail.querySelector('.play-ad-box');
  // The head script ran earlier; the token may have come or gone since.
  const buyer = mayBeAdFree();
  document.documentElement.classList.toggle('ad-free', buyer);
  if (!buyer) return startPlayAd(box);
  load()
    .then(() => window.ihtfyAds.adFree())
    .then(
      free => {
        if (free) return;
        document.documentElement.classList.remove('ad-free');
        startPlayAd(box);
      },
      () => {}, // The loader didn't arrive, so no ad could show either.
    );
}
// ads:end

setUpPlayAd(document.getElementById('playAd'));

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
let wasSolved = false;
let exampleFen = null;
let solves = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const numberStates = new WeakMap();

function animateNumber(element, target, prefix = '') {
  let state = numberStates.get(element);
  if (state?.target === target && state.prefix === prefix) return;
  if (state) clearTimeout(state.timer);
  const start = state?.value;
  state = { value: start ?? target, target, prefix };
  numberStates.set(element, state);
  const immediate = !Number.isInteger(start) || !Number.isInteger(target) || reducedMotion.matches;
  const step = immediate ? 0 : Math.sign(target - start);
  const interval = Math.min(28, 280 / Math.max(1, Math.abs(target - start)));
  const tick = () => {
    state.value = step ? state.value + step : target;
    element.textContent = prefix + state.value;
    if (state.value !== target) state.timer = setTimeout(tick, interval);
  };
  if (immediate || start === target) tick();
  else state.timer = setTimeout(tick, interval);
}

reducedMotion.addEventListener('change', () => {
  if (!reducedMotion.matches) return;
  for (const element of document.querySelectorAll('[data-quantity], #pieceCount, #optimalCount, #coveredCount, #totalCount')) {
    const state = numberStates.get(element);
    if (!state) continue;
    clearTimeout(state.timer);
    state.value = state.target;
    element.textContent = state.prefix + state.target;
  }
});
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
  if (!$('score-body').children.length) $('score-body').innerHTML = pieces.map(piece => `
    <tr data-score-piece="${piece}"><th scope="row">${names[piece]}</th>
    <td id="${full(piece)}Count" data-quantity></td>
    <td class="best-value"><span id="${full(piece)}Best" data-quantity></span><span class="score-difference" data-quantity></span></td>
    <td class="score-optimal" data-quantity></td></tr>`).join('');
  for (const piece of pieces) {
    const row = document.querySelector(`[data-score-piece="${piece}"]`);
    const { pb, wr } = scores[gameMode][piece];
    const hasRecord = gameMode === 'MIN' ? pb !== 64 : pb !== 0;
    const gap = hasRecord ? Math.abs(pb - wr) : 0;
    const description = !hasRecord ? 'No valid board recorded' : gap === 0 ? 'Matches optimal' : gameMode === 'MIN'
      ? `${gap} extra piece${gap === 1 ? '' : 's'} above the minimum`
      : `${gap} piece${gap === 1 ? '' : 's'} below the maximum`;
    row.classList.toggle('active-score', piece === selected);
    const best = row.querySelector('.best-value');
    best.classList.toggle('off-optimal', gap > 0);
    best.title = description;
    const diff = row.querySelector('.score-difference');
    diff.hidden = gap === 0;
    diff.setAttribute('aria-label', description);
    animateNumber(diff, gap, gameMode === 'MIN' ? '+' : '−');
    animateNumber($(`${full(piece)}Count`), counts[piece]);
    animateNumber($(`${full(piece)}Best`), hasRecord ? pb : '–');
    animateNumber(row.querySelector('.score-optimal'), wr);
  }
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
  animateNumber($('pieceCount'), count);
  animateNumber($('optimalCount'), target);
  $('goal-label').textContent = gameMode === 'MIN' ? 'Minimum' : 'Maximum';
  const value = gameMode === 'MIN' ? (types.length > 1 ? 0 : 64 - issues.length) : count - issues.length;
  const total = gameMode === 'MIN' ? 64 : count;
  animateNumber($('coveredCount'), value);
  animateNumber($('totalCount'), total);
  $('coverage-label').textContent = gameMode === 'MIN' ? 'Covered' : 'Safe pieces';
  $('progress').style.width = `${total ? value / total * 100 : 0}%`;
  $('selected-name').textContent = names[selected];
  $('dominationBtn').setAttribute('aria-pressed', String(gameMode === 'MIN'));
  $('nonAttackingBtn').setAttribute('aria-pressed', String(gameMode === 'MAX'));
  document.querySelector('.mode').dataset.mode = gameMode;
  $('highlightSwitch').setAttribute('aria-pressed', String(hints));
  $('highlightSwitch').setAttribute('aria-label', gameMode === 'MIN' ? 'Highlight uncovered squares' : 'Highlight attacking pieces');
  if (types.length > 1) $('hint').textContent = 'Use one piece type at a time.';
  else if (valid && count === target) $('hint').textContent = gameMode === 'MIN'
    ? 'Optimal solution. Every square is covered.' : 'Optimal solution. No pieces attack each other.';
  else if (valid && gameMode === 'MIN') $('hint').textContent = 'Every square is covered. Try using fewer pieces.';
  else if (gameMode === 'MAX' && issues.length) $('hint').textContent = 'Some pieces are attacking. Tap a piece to remove it.';
  else $('hint').textContent = `Tap or drag to place a ${names[selected].toLowerCase()}. Tap again to remove it.`;
  highlight(hints ? issues : [], gameMode);
  const solved = valid && count === target;
  if (solved && !wasSolved && objToFen(pos) !== exampleFen) celebrate(count);
  wasSolved = solved;
  renderScores(pos);
  queueMicrotask(() => board.updateComplete.then(decorateBoard));
}

// A board the player solved opens the results screen that carries the ad. Examples don't.
function celebrate(count) {
  const key = `${gameMode}-${selected}-${count}-${++solves}`;
  setTimeout(() => {
    if (!wasSolved || objToFen(latestPosition) === exampleFen || document.querySelector('dialog[open]')) return;
    const name = names[selected].toLowerCase();
    $('solved-text').textContent = gameMode === 'MIN'
      ? `${count} ${name}s cover every square. That is the minimum.`
      : `${count} ${name}s and none attack another. That is the maximum.`;
    cancelDrag();
    openResults(key);
  }, 500);
}

const results = $('solvedPanel');
let focusBeforeResults = null;

// The results replace the board and its controls, so the ad has no pop-up or backdrop around it
// and nothing to cover it. The header buttons and the update toast are out of sight meanwhile.
function openResults(key) {
  focusBeforeResults = board.shadowRoot?.activeElement ?? document.activeElement;
  document.querySelector('.layout').hidden = true;
  results.hidden = false;
  $('app').classList.add('on-results');
  showScreenAd(AD_SCREEN, results, key);
  $('playAgainBtn').focus();
}

function closeResults() {
  if (results.hidden) return;
  clearScreenAd(results);
  results.hidden = true;
  document.querySelector('.layout').hidden = false;
  $('app').classList.remove('on-results');
  focusBeforeResults?.focus();
}

board.addEventListener('change', event => {
  playSound(clicks[soundIndex++ % clicks.length]);
  updateStats(event.detail.value);
});

function selectPiece(piece, clear = true) {
  if (selected === piece) return;
  selected = piece;
  if (clear) {
    board.clear(false);
    newPlayAd();
  }
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
  exampleFen = objToFen(next);
  board.setPosition(next, !reducedMotion.matches);
  $('exampleBtn').disabled = true;
  setTimeout(() => { $('exampleBtn').disabled = false; }, reducedMotion.matches ? 0 : 240);
});
const clearBoard = () => { cancelDrag(); board.clear(false); newPlayAd(); };
$('clearBtn').addEventListener('click', clearBoard);
$('playAgainBtn').addEventListener('click', () => { closeResults(); clearBoard(); });
$('backBtn').addEventListener('click', closeResults);
addEventListener('keydown', event => { if (event.key === 'Escape') closeResults(); });
for (const [id, mode] of [['dominationBtn', 'MIN'], ['nonAttackingBtn', 'MAX']]) {
  $(id).addEventListener('click', () => {
    if (gameMode === mode) return;
    cancelDrag(); gameMode = mode; updateStats(board.position); newPlayAd();
    if (!reducedMotion.matches) for (const el of [$('goal-label'), $('coverage-label'), $('hint'), $('boardPanel')]) {
      el.getAnimations().forEach(animation => animation.cancel());
      el.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
  });
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
const safeDemo = $('safe-demo');
const svgNS = 'http://www.w3.org/2000/svg';
const rays = document.createElementNS(svgNS, 'svg');
rays.setAttribute('viewBox', '0 0 4 4');
rays.classList.add('attack-rays');
rays.innerHTML = '<defs>' + ['blue', 'red'].map(color => `<marker id="ray-${color}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${color === 'blue' ? '#64b5ff' : '#ff7b86'}"/></marker>`).join('') + '</defs>';
for (const [index, [x, y]] of [[0, 3], [2, 0]].entries()) {
  const color = index === 0 ? 'blue' : 'red';
  safeDemo.children[y * 4 + x].classList.add(`queen-${color}`);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const cx = x + .5, cy = y + .5;
    const distance = Math.min(dx > 0 ? (3.88 - cx) / dx : dx < 0 ? (.12 - cx) / dx : Infinity,
      dy > 0 ? (3.88 - cy) / dy : dy < 0 ? (.12 - cy) / dy : Infinity);
    if (distance < .6) continue;
    const line = document.createElementNS(svgNS, 'line');
    for (const [name, value] of Object.entries({ x1: cx + dx * .35, y1: cy + dy * .35, x2: cx + dx * distance, y2: cy + dy * distance, stroke: color === 'blue' ? '#64b5ff' : '#ff7b86', 'marker-end': `url(#ray-${color})` })) line.setAttribute(name, value);
    rays.append(line);
  }
}
safeDemo.append(rays);
$('adBox').dataset.adSlot = AD_SLOT;
loadForBuyer();
syncSound();
updateStats(board.position);
decorateBoard();

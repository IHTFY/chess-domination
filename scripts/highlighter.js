const highlightStyles = document.createElement('style');
document.head.append(highlightStyles);
const highlightWhite = '#ffa0a0';
const highlightBlack = '#ff2b40';

const clearHighlights = () => {
  highlightStyles.textContent = '';
};

const highlightSquare = (square) => {
  const highlightColor = (square.charCodeAt(0) % 2) ^ (square.charCodeAt(1) % 2)
    ? highlightWhite
    : highlightBlack;

  highlightStyles.textContent += `chess-board::part(${square}) {
  background-color: ${highlightColor};
}`;
};

const highlight = (squares) => {
  clearHighlights();
  if (!squares.length) return;
  for (let square of squares) {
    highlightSquare(square);
  }
};

export { clearHighlights, highlight };
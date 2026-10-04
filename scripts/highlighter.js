const highlightStyles = document.createElement('style');
document.head.append(highlightStyles);

const clearHighlights = () => { highlightStyles.textContent = ''; };

const highlight = (squares, mode = 'MAX') => {
  highlightStyles.textContent = squares.map(square => mode === 'MIN'
    ? `#board::part(${square})::after { content: ''; position: absolute; top: 43.5%; left: 43.5%; width: 13%; height: 13%; border-radius: 50%; background: #dab486; box-shadow: 0 0 0 4px #08121e20; pointer-events: none; }`
    : `#board::part(${square}) { box-shadow: inset 0 0 0 3px #dba2a2; }`).join('\n');
};

export { clearHighlights, highlight };

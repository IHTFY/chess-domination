import { letter, index, countPieces } from './utils.js';

// Check if board position is valid solution for the current game mode
const isValid = (pos, mode) => {
  const occupied = Object.keys(pos);

  // if pos is empty, return false
  if (occupied.length === 0)
    return false;

  // if there is more than one type of piece, return false
  const pieceCount = countPieces(pos);
  if (Object.values(pieceCount).filter(i => i > 0).length > 1)
    return false;

  const pieceType = Object.values(pos)[0][1];


  const rows = new Set();
  const cols = new Set();
  const diags = new Set();
  const antidiags = new Set();
  for (let p of occupied) {
    const [f, r] = p.split('');
    rows.add(+r);
    cols.add(index(f));
    diags.add(+r + index(f));
    antidiags.add(index(f) - r);
  }

  switch (pieceType) {
    case 'K':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const [f, r] = v.split('');
          const [below, above] = [+r - 1, +r + 1];
          const [left, right] = [index(f) - 1, index(f) + 1].map(i => letter(i));
          return !pos[left + above] && !pos[f + above] && !pos[right + above] &&
            !pos[left + r] && !pos[right + r] &&
            !pos[left + below] && !pos[f + below] && !pos[right + below];
        });
      } else {
        let covered = new Set();

        // add a border of out of bounds squares (36 squares)
        for (let i = 0; i <= 9; i++) {
          covered.add(letter(0) + i); // left 
          covered.add(letter(9) + i); // right
        }
        for (let i = 1; i <= 8; i++) {
          covered.add(letter(i) + 9); // top
          covered.add(letter(i) + 0); // bottom
        }

        const oob = covered.size; // 36

        for (let p of occupied) {
          // add all the squares around the king
          const [f, r] = p.split('');
          const [below, above] = [+r - 1, +r + 1];
          const [left, right] = [index(f) - 1, index(f) + 1].map(i => letter(i));
          covered.add(left + above);
          covered.add(f + above);
          covered.add(right + above);
          covered.add(left + r);
          covered.add(f + r);
          covered.add(right + r);
          covered.add(left + below);
          covered.add(f + below);
          covered.add(right + below);
        }

        return covered.size - oob === 64;
      }
    case 'Q':
      if (mode === 'MAX') {
        return rows.size === occupied.length &&
          cols.size === occupied.length &&
          diags.size === occupied.length &&
          antidiags.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(rows.has(r) || cols.has(f) || diags.has(f + r) || antidiags.has(f - r)))
              return false;

          }
        }
        return true;
      }
    case 'R':
      if (mode === 'MAX') {
        return rows.size === occupied.length
          && cols.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(rows.has(r) || cols.has(f)))
              return false;
          }
        }
        return true;
      }
    case 'B':
      if (mode === 'MAX') {
        return diags.size === occupied.length
          && antidiags.size === occupied.length;
      } else {
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(diags.has(f + r) || antidiags.has(f - r)))
              return false;
          }
        }
        return true;
      }
    case 'N':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const f = index(v[0]);
          const r = +v[1];
          // reference clockface
          const p1 = pos[letter(f + 1) + (r + 2)];
          const p2 = pos[letter(f + 2) + (r + 1)];
          const p4 = pos[letter(f + 2) + (r - 1)];
          const p5 = pos[letter(f + 1) + (r - 2)];
          const p7 = pos[letter(f - 1) + (r - 2)];
          const p8 = pos[letter(f - 2) + (r - 1)];
          const p10 = pos[letter(f - 2) + (r + 1)];
          const p11 = pos[letter(f - 1) + (r + 2)];

          return !(p1 || p2 || p4 || p5 || p7 || p8 || p10 || p11);
        });
      } else {
        // for each square, check if there is a knight on it or one jump away
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(occupied.includes(letter(f) + r) ||
              occupied.includes(letter(f + 1) + (r + 2)) ||
              occupied.includes(letter(f + 2) + (r + 1)) ||
              occupied.includes(letter(f + 2) + (r - 1)) ||
              occupied.includes(letter(f + 1) + (r - 2)) ||
              occupied.includes(letter(f - 1) + (r - 2)) ||
              occupied.includes(letter(f - 2) + (r - 1)) ||
              occupied.includes(letter(f - 2) + (r + 1)) ||
              occupied.includes(letter(f - 1) + (r + 2))))
              return false;
          }
        }
        return true;
      }
    case 'P':
      if (mode === 'MAX') {
        return occupied.every(v => {
          const f = index(v[0]);
          const ahead = +v[1] + 1;
          const left = pos[letter(f + 1) + ahead];
          const right = pos[letter(f - 1) + ahead];

          return !(left || right);
        });
      } else {
        // for each square, check if there is a pawn on it or attacking it
        for (let f = 1; f <= 8; f++) {
          for (let r = 1; r <= 8; r++) {
            if (!(occupied.includes(letter(f) + r) ||
              occupied.includes(letter(f + 1) + (r - 1)) ||
              occupied.includes(letter(f - 1) + (r - 1)))) {
              console.log(letter(f) + r);
              return false;
            }
          }
        }
        return true;
      }
    default:
      return false;
  }
};

export { isValid };
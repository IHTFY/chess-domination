export const defaultScores = {
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

// Storage may be unavailable, malformed, or from an older version of the app.
export const readStored = key => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Continue playing when browser storage is blocked or full.
  }
};

const readJSON = key => {
  try {
    return JSON.parse(readStored(key));
  } catch {
    return null;
  }
};

export const readBoolean = (key, fallback = true) => {
  const value = readJSON(key);
  return typeof value === 'boolean' ? value : fallback;
};

export const readMode = () => readStored('gameMode') === 'MIN' ? 'MIN' : 'MAX';

export const readScores = () => {
  const saved = readJSON('scores');
  const scores = structuredClone(defaultScores);
  for (const mode of ['MAX', 'MIN']) {
    for (const piece of Object.keys(scores[mode])) {
      const pb = saved?.[mode]?.[piece]?.pb;
      const best = scores[mode][piece].wr;
      // MIN uses 64 as the initial unsolved score. Keep only plausible records.
      const valid = Number.isInteger(pb) && (mode === 'MAX'
        ? pb >= 0 && pb <= best
        : pb >= best && pb <= 64);
      if (valid) scores[mode][piece].pb = pb;
    }
  }
  return scores;
};

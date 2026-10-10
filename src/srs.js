// Leitner-Karteikasten: 5 Fächer, Wiedervorlage in Tagen je Fach.

export const INTERVALS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 };
export const MAX_BOX = 5;
// Fehlwort = einmal falsch; "sitzt" erst wieder ab Fach 3 (an zwei Tagen richtig).
export const STRUGGLING_UNTIL_BOX = 3;

export function isDue(state, today) {
  if (!state) return false;
  return today >= state.last + INTERVALS[state.box];
}

export function overdueBy(state, today) {
  return today - (state.last + INTERVALS[state.box]);
}

/** outcome: 'correct' | 'almost' | 'other' | 'wrong' */
export function applyAnswer(state, outcome, today) {
  const prev = state ?? { box: 1, last: today, reviews: 0, correct: 0 };
  let box = prev.box;
  let struggling = prev.struggling ?? false;
  if (outcome === 'correct') {
    box = state ? Math.min(MAX_BOX, prev.box + 1) : 2;
    if (box >= STRUGGLING_UNTIL_BOX) struggling = false;
  } else if (outcome !== 'other') {
    box = 1;
    struggling = true;
  }
  return {
    ...prev,
    box,
    struggling,
    last: today,
    reviews: prev.reviews + 1,
    correct: prev.correct + (outcome === 'correct' ? 1 : 0),
  };
}

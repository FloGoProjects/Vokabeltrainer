// Lernbereich wählen und eine Runde zusammenstellen.
import { isDue, overdueBy } from './srs.js';

export function filterCards(cards, { sections, pageFrom, pageTo } = {}) {
  return cards.filter((c) => {
    if (sections && !sections.includes(c.sec)) return false;
    if (pageFrom != null && (c.p == null || c.p < pageFrom)) return false;
    if (pageTo != null && (c.p == null || c.p > pageTo)) return false;
    return true;
  });
}

function shuffleRandom(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { shuffleRandom };

const byOverdue = (states, today) => (a, b) => overdueBy(states[b.id], today) - overdueBy(states[a.id], today);

/**
 * cards = gewählter Bereich; allCards = alle Karten, aus denen fällige Fehlwörter
 * zusätzlich mitkommen (höchstens maxStruggling), auch wenn sie außerhalb des Bereichs liegen.
 */
export function buildSession(cards, states, today, {
  allCards = [], size = 15, maxNew = 10, maxStruggling = 8, shuffle = shuffleRandom,
} = {}) {
  const inRange = new Set(cards.map((c) => c.id));
  const struggling = allCards
    .filter((c) => !inRange.has(c.id) && states[c.id]?.struggling && isDue(states[c.id], today))
    .sort(byOverdue(states, today))
    .slice(0, Math.min(maxStruggling, size));
  const due = cards
    .filter((c) => isDue(states[c.id], today))
    .sort(byOverdue(states, today))
    .slice(0, size - struggling.length);
  const taken = struggling.length + due.length;
  const fresh = cards.filter((c) => !states[c.id]).slice(0, Math.max(0, Math.min(maxNew, size - taken)));
  return shuffle([...struggling, ...due, ...fresh]);
}

export function countStruggling(cards, states, today) {
  return cards.filter((c) => states[c.id]?.struggling && isDue(states[c.id], today)).length;
}

export function countByStatus(cards, states, today) {
  const counts = { new: 0, due: 0, learning: 0, mastered: 0 };
  for (const c of cards) {
    const s = states[c.id];
    if (!s) counts.new++;
    else if (isDue(s, today)) counts.due++;
    else if (s.box === 5) counts.mastered++;
    else counts.learning++;
  }
  return counts;
}

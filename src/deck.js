// Prüfung einer Vokabeldatei (data/<lang>/unit-XX.json) – genutzt von App-Import und check-vocab.
import { acceptedAnswers } from './answer.js';

export function validateDeck(deck) {
  if (!deck || !Array.isArray(deck.cards) || typeof deck.sections !== 'object' || deck.unit == null) {
    return ['keine Vokabeldatei (cards, sections, unit fehlen)'];
  }
  const problems = [];
  const ids = new Set();
  for (const c of deck.cards) {
    const label = c.id ?? '(ohne id)';
    for (const field of ['id', 'en', 'de', 'sec']) {
      if (!c[field]) problems.push(`${label}: ${field} fehlt`);
    }
    if (ids.has(c.id)) problems.push(`${label}: ID doppelt`);
    ids.add(c.id);
    if (c.sec && !(c.sec in deck.sections)) problems.push(`${label}: Abschnitt "${c.sec}" unbekannt`);
    if (c.p != null && !Number.isInteger(c.p)) problems.push(`${label}: Seite ist keine Zahl`);
    if (c.en && acceptedAnswers(c.en).length === 0) problems.push(`${label}: keine mögliche Antwort`);
  }
  return problems;
}

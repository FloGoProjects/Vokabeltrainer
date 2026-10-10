// Prüft alle Vokabeldateien aus data/index.json. Aufruf: npm run check-vocab [-- --answers]
import { readFileSync } from 'node:fs';
import { acceptedAnswers } from '../src/answer.js';
import { validateDeck } from '../src/deck.js';

const showAnswers = process.argv.includes('--answers');
const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const seen = new Set();
let errors = 0;
let unsure = 0;

for (const file of index.decks) {
  const deck = JSON.parse(readFileSync(`data/${file}`, 'utf8'));
  const problems = validateDeck(deck);
  for (const c of deck.cards ?? []) {
    if (seen.has(c.id)) problems.push(`${c.id}: ID doppelt (dateiübergreifend)`);
    seen.add(c.id);
    if (c.unsure) unsure++;
    if (showAnswers) console.log(`${c.id}  ${c.en}  →  ${acceptedAnswers(c.en).join(' | ')}`);
  }
  problems.forEach((p) => console.error(`  ✗ ${file}: ${p}`));
  errors += problems.length;
  console.log(`${file}: ${deck.cards?.length ?? 0} Karten, ${problems.length} Fehler`);
}
console.log(`${unsure} Karten als unsicher markiert`);
process.exit(errors ? 1 : 0);

// Antwortprüfung: Buch-Schreibweise ("(to) catch a train/bus/...") → akzeptierte Eingaben.

const LABELS = /\((pl|no pl|infml)\)/g;
const PLACEHOLDER = /^(sth|sb)\.?$/;
const LEADING_FILLER = /^(to|a|an|the)\s+/;
const MIN_LENGTH_FOR_ALMOST = 4;

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
}

// Führendes "to"/Artikel entfernen – gilt für Eingabe und Lösung gleichermaßen.
function canonical(s) {
  let out = normalize(s);
  while (LEADING_FILLER.test(out)) out = out.replace(LEADING_FILLER, '');
  return out;
}

function expandParentheses(s) {
  const match = s.match(/\(([^()]*)\)/);
  if (!match) return [s];
  const before = s.slice(0, match.index);
  const after = s.slice(match.index + match[0].length);
  return [
    ...expandParentheses(before + ' ' + after),
    ...expandParentheses(before + match[1] + after),
  ];
}

function expandSlashes(s) {
  let variants = [[]];
  for (const token of s.split(' ').filter(Boolean)) {
    const options = token
      .split('/')
      .filter((o) => o && o !== '...' && !PLACEHOLDER.test(o));
    if (options.length === 0) continue;
    variants = variants.flatMap((v) => options.map((o) => [...v, o]));
  }
  return variants.map((v) => v.join(' '));
}

export function acceptedAnswers(en) {
  const base = normalize(String(en).replace(LABELS, ''));
  const result = new Set();
  for (const variant of expandParentheses(base)) {
    for (const answer of expandSlashes(normalize(variant))) {
      const a = normalize(answer);
      if (!a) continue;
      result.add(a);
      // "lend sth. to sb." → auch "lend"
      if (/ to$/.test(a) && /\b(sth|sb)\.?\s+to\s+(sth|sb)\b/.test(variant)) result.add(a.replace(/ to$/, ''));
    }
  }
  return [...result];
}

function germanMeanings(de) {
  return String(de)
    .replace(/\([^()]*\)/g, ' ')
    .split(/[;,]/)
    .map((m) => normalize(m).replace(/^(der|die|das|ein|eine)\s+/, '').trim())
    .filter(Boolean);
}

function sharesMeaning(a, b) {
  const mb = new Set(germanMeanings(b.de));
  return germanMeanings(a.de).some((m) => mb.has(m));
}

export function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * @returns {{result: 'correct'|'almost'|'other'|'wrong', expected: string, matched?: string}}
 */
export function checkAnswer(input, card, allCards = []) {
  const expected = card.en;
  const given = canonical(input);
  if (!given) return { result: 'wrong', expected };

  const accepted = acceptedAnswers(card.en).map(canonical);
  if (accepted.includes(given)) return { result: 'correct', expected };

  for (const other of allCards) {
    if (other.id === card.id || !sharesMeaning(card, other)) continue;
    if (acceptedAnswers(other.en).map(canonical).includes(given)) {
      return { result: 'other', expected, matched: other.en };
    }
  }

  const almost = accepted.some(
    (a) => a.length >= MIN_LENGTH_FOR_ALMOST && levenshtein(a, given) <= 1,
  );
  return { result: almost ? 'almost' : 'wrong', expected };
}

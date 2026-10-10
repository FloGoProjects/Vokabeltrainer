import { describe, it, expect } from 'vitest';
import { validateDeck } from '../src/deck.js';

const deck = (cards) => ({ lang: 'en', unit: 1, title: 'T', sections: { A: 'Part A' }, cards });

describe('validateDeck', () => {
  it('akzeptiert gültige Karten', () => {
    expect(validateDeck(deck([{ id: 'en-u1-001', en: 'x', de: 'y', p: 1, sec: 'A' }]))).toEqual([]);
  });

  it('meldet fehlende Felder, doppelte IDs und unbekannte Abschnitte', () => {
    const problems = validateDeck(deck([
      { id: 'a', en: 'x', de: '', p: 1, sec: 'A' },
      { id: 'a', en: 'x', de: 'y', p: 1, sec: 'Z' },
    ]));
    expect(problems.join('\n')).toMatch(/de fehlt/);
    expect(problems.join('\n')).toMatch(/doppelt/);
    expect(problems.join('\n')).toMatch(/Abschnitt/);
  });

  it('meldet Karten ohne mögliche Antwort', () => {
    expect(validateDeck(deck([{ id: 'a', en: '(sth.)', de: 'y', p: 1, sec: 'A' }])).join()).toMatch(/Antwort/);
  });

  it('lehnt Nicht-Decks ab', () => {
    expect(validateDeck({}).length).toBeGreaterThan(0);
  });
});

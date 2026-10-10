import { describe, it, expect } from 'vitest';
import { acceptedAnswers, checkAnswer, levenshtein } from '../src/answer.js';

const card = (id, en, de) => ({ id, en, de });

describe('acceptedAnswers', () => {
  it('entfernt (to) und Platzhalter sth./sb.', () => {
    expect(acceptedAnswers('(to) drop sth.')).toContain('drop');
    expect(acceptedAnswers('(to) introduce sth./sb. (to sb.)')).toContain('introduce');
  });

  it('akzeptiert das Verb ohne hängendes "to" nach entferntem Platzhalter', () => {
    const a = acceptedAnswers('(to) lend sth. to sb.');
    expect(a).toContain('lend');
    expect(a).toContain('lend to');
    expect(acceptedAnswers('(to) get over sth.')).not.toContain('get');
  });

  it('macht Klammerteile optional', () => {
    const a = acceptedAnswers('(to) nod (your head)');
    expect(a).toContain('nod');
    expect(a).toContain('nod your head');
  });

  it('löst Schrägstrich-Varianten auf und ignoriert ...', () => {
    const a = acceptedAnswers('(to) catch a train/bus/...');
    expect(a).toContain('catch a train');
    expect(a).toContain('catch a bus');
    expect(a).not.toContain('catch a ...');
  });

  it('ignoriert Satzzeichen am Ende', () => {
    expect(acceptedAnswers('Cheer up.')).toContain('cheer up');
    expect(acceptedAnswers('Break a leg!')).toContain('break a leg');
  });

  it('entfernt Grammatik-Etiketten wie (pl)', () => {
    expect(acceptedAnswers('manners (pl)')).toEqual(['manners']);
  });
});

describe('checkAnswer', () => {
  const mood = card('m', 'mood', 'die Stimmung, die Laune');
  const atmo = card('a', 'atmosphere', 'die Atmosphäre; die Stimmung');
  const all = [mood, atmo, card('c', '(to) catch a train/bus/...', 'einen Zug nehmen')];

  it('erkennt richtige Antworten unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(checkAnswer('  Mood ', mood, all).result).toBe('correct');
  });

  it('akzeptiert getipptes "to" und Artikel', () => {
    expect(checkAnswer('to catch a bus', all[2], all).result).toBe('correct');
    expect(checkAnswer('the mood', mood, all).result).toBe('correct');
  });

  it('meldet "fast richtig" bei einem falschen Buchstaben', () => {
    const r = checkAnswer('atmosphäre', atmo, all);
    expect(r.result).toBe('almost');
    expect(r.expected).toBe('atmosphere');
  });

  it('wertet Akzente streng', () => {
    const cafe = card('x', 'café', 'das Café');
    expect(checkAnswer('cafe', cafe, [cafe]).result).toBe('almost');
    expect(checkAnswer('café', cafe, [cafe]).result).toBe('correct');
  });

  it('erkennt eine andere Karte mit gleicher deutscher Bedeutung', () => {
    const r = checkAnswer('atmosphere', mood, all);
    expect(r.result).toBe('other');
    expect(r.expected).toBe('mood');
  });

  it('wertet Unsinn als falsch', () => {
    expect(checkAnswer('banana', mood, all).result).toBe('wrong');
    expect(checkAnswer('', mood, all).result).toBe('wrong');
  });

  it('wertet kurze Wörter mit Tippfehler nicht als fast richtig', () => {
    const oil = card('o', 'oil', 'das Öl');
    expect(checkAnswer('oii', oil, [oil]).result).toBe('wrong');
  });
});

describe('levenshtein', () => {
  it('zählt Einfügen, Löschen, Ersetzen', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

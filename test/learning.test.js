import { describe, it, expect } from 'vitest';
import { isDue, applyAnswer, INTERVALS } from '../src/srs.js';
import { goldForAnswer, streakBonus, DAILY_GOAL } from '../src/gold.js';
import { filterCards, buildSession } from '../src/session.js';
import { createState, recordAnswer, redeem, validateImport, todayNumber } from '../src/store.js';

const T = 1000; // "heute" als Tagesnummer

describe('Karteikasten (srs)', () => {
  it('neue Karte richtig → Fach 2, falsch → Fach 1', () => {
    expect(applyAnswer(undefined, 'correct', T).box).toBe(2);
    expect(applyAnswer(undefined, 'wrong', T).box).toBe(1);
  });

  it('falsch und fast richtig werfen zurück in Fach 1', () => {
    expect(applyAnswer({ box: 4, last: T - 7, reviews: 3, correct: 3 }, 'wrong', T).box).toBe(1);
    expect(applyAnswer({ box: 4, last: T - 7, reviews: 3, correct: 3 }, 'almost', T).box).toBe(1);
  });

  it('"andere Karte" lässt das Fach unverändert', () => {
    expect(applyAnswer({ box: 3, last: T - 3, reviews: 2, correct: 2 }, 'other', T).box).toBe(3);
  });

  it('Fach 5 ist das höchste', () => {
    expect(applyAnswer({ box: 5, last: T - 21, reviews: 5, correct: 5 }, 'correct', T).box).toBe(5);
  });

  it('zählt Abfragen und richtige Antworten', () => {
    const s = applyAnswer({ box: 2, last: T - 1, reviews: 1, correct: 1 }, 'correct', T);
    expect(s).toMatchObject({ box: 3, last: T, reviews: 2, correct: 2 });
  });

  it('falsche Antwort macht die Karte zum Fehlwort, bis sie Fach 3 erreicht', () => {
    const wrong = applyAnswer({ box: 3, last: T - 3, reviews: 2, correct: 2 }, 'wrong', T);
    expect(wrong.struggling).toBe(true);
    const box2 = applyAnswer(wrong, 'correct', T + 1);
    expect(box2).toMatchObject({ box: 2, struggling: true });
    const box3 = applyAnswer(box2, 'correct', T + 2);
    expect(box3).toMatchObject({ box: 3, struggling: false });
  });

  it('neue Karte falsch ist ebenfalls ein Fehlwort', () => {
    expect(applyAnswer(undefined, 'almost', T).struggling).toBe(true);
    expect(applyAnswer(undefined, 'correct', T).struggling).toBeFalsy();
  });

  it('Fälligkeit folgt den Intervallen', () => {
    expect(INTERVALS).toEqual({ 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 });
    expect(isDue({ box: 1, last: T }, T)).toBe(true);
    expect(isDue({ box: 2, last: T }, T)).toBe(false);
    expect(isDue({ box: 3, last: T - 3 }, T)).toBe(true);
    expect(isDue(undefined, T)).toBe(false);
  });
});

describe('Gold', () => {
  it('neue Karte richtig = 2 Gold, falsch = 0', () => {
    expect(goldForAnswer(undefined, 'correct', T)).toBe(2);
    expect(goldForAnswer(undefined, 'wrong', T)).toBe(0);
    expect(goldForAnswer(undefined, 'other', T)).toBe(0);
  });

  it('mehr Gold, je länger die letzte Abfrage zurückliegt', () => {
    const recent = goldForAnswer({ box: 2, last: T - 1, correct: 1 }, 'correct', T);
    const old = goldForAnswer({ box: 5, last: T - 30, correct: 1 }, 'correct', T);
    expect(old).toBeGreaterThan(recent);
  });

  it('weniger Gold, je öfter die Karte schon gekonnt wurde (mind. 1)', () => {
    const fresh = goldForAnswer({ box: 4, last: T - 7, correct: 1 }, 'correct', T);
    const worn = goldForAnswer({ box: 4, last: T - 7, correct: 10 }, 'correct', T);
    expect(worn).toBeLessThan(fresh);
    expect(goldForAnswer({ box: 4, last: T - 7, correct: 100 }, 'correct', T)).toBe(1);
  });

  it('kein Gold für nicht fällige Karten (kein Farmen)', () => {
    expect(goldForAnswer({ box: 3, last: T - 1, correct: 2 }, 'correct', T)).toBe(0);
  });

  it('pro Karte höchstens einmal am Tag Gold', () => {
    expect(goldForAnswer({ box: 1, last: T, correct: 1, goldDay: T }, 'correct', T)).toBe(0);
  });

  it('Serienbonus +2 je Tag, max. 10', () => {
    expect(streakBonus(1)).toBe(2);
    expect(streakBonus(3)).toBe(6);
    expect(streakBonus(9)).toBe(10);
  });
});

const cards = [
  { id: 'a', en: 'a', de: 'A', p: null, sec: 'intro' },
  { id: 'b', en: 'b', de: 'B', p: 16, sec: 'start' },
  { id: 'c', en: 'c', de: 'C', p: 18, sec: 'A' },
  { id: 'd', en: 'd', de: 'D', p: 19, sec: 'A' },
  { id: 'e', en: 'e', de: 'E', p: 26, sec: 'B' },
];

describe('Lernbereich und Runde', () => {
  it('filtert nach Abschnitten in Buchreihenfolge', () => {
    expect(filterCards(cards, { sections: ['A', 'start'] }).map((c) => c.id)).toEqual(['b', 'c', 'd']);
  });

  it('filtert nach Seitenbereich', () => {
    expect(filterCards(cards, { pageFrom: 17, pageTo: 26 }).map((c) => c.id)).toEqual(['c', 'd', 'e']);
  });

  it('fällige Karten zuerst, dann neue, mit Obergrenzen', () => {
    const states = {
      e: { box: 2, last: T - 5 },
      d: { box: 2, last: T }, // nicht fällig
    };
    const s = buildSession(cards, states, T, { size: 3, maxNew: 2, shuffle: (x) => x });
    expect(s.map((c) => c.id)).toEqual(['e', 'a', 'b']);
  });

  it('fällige Fehlwörter kommen auch außerhalb des gewählten Bereichs mit', () => {
    const states = {
      a: { box: 1, last: T - 1, struggling: true }, // Welcome, nicht im Bereich
      e: { box: 2, last: T - 3, struggling: true }, // Part B, nicht im Bereich
      b: { box: 2, last: T, struggling: true }, // nicht fällig
    };
    const range = filterCards(cards, { sections: ['A'] });
    const s = buildSession(range, states, today(), { allCards: cards, size: 15, shuffle: (x) => x });
    expect(s.map((c) => c.id)).toEqual(['e', 'a', 'c', 'd']);
    function today() { return T; }
  });

  it('Fehlwörter belegen höchstens maxStruggling Plätze', () => {
    const states = Object.fromEntries(cards.map((c) => [c.id, { box: 1, last: T - 1, struggling: true }]));
    const range = filterCards(cards, { sections: ['A'] });
    const s = buildSession(range, states, T, { allCards: cards, size: 15, maxStruggling: 2, shuffle: (x) => x });
    // 2 Fehlwörter von außerhalb + die beiden fälligen Karten im Bereich (c, d)
    expect(s).toHaveLength(4);
    expect(s.filter((c) => !['c', 'd'].includes(c.id))).toHaveLength(2);
  });

  it('höchstens maxNew neue Karten', () => {
    const s = buildSession(cards, {}, T, { size: 15, maxNew: 2, shuffle: (x) => x });
    expect(s).toHaveLength(2);
  });
});

describe('Spielstand (store)', () => {
  const card = { id: 'x', en: 'mood', de: 'die Laune' };

  it('richtige Antwort bucht Gold und Protokoll', () => {
    const { state, gold } = recordAnswer(createState(), card, 'correct', T);
    expect(gold).toBe(2);
    expect(state.gold).toBe(2);
    expect(state.cards.x.box).toBe(2);
    expect(state.cards.x.goldDay).toBe(T);
  });

  it('Tagesziel bringt einmalig Bonus und Serie', () => {
    let state = createState();
    state.daily = { day: T, correct: DAILY_GOAL - 1, goalReached: false };
    state.streak = { count: 2, lastDay: T - 1 };
    const r = recordAnswer(state, card, 'correct', T);
    expect(r.bonus).toBe(10 + 6);
    expect(r.state.streak).toEqual({ count: 3, lastDay: T });
    const r2 = recordAnswer(r.state, { ...card, id: 'y' }, 'correct', T);
    expect(r2.bonus).toBe(0);
  });

  it('Serie reißt nach einem ausgelassenen Tag', () => {
    let state = createState();
    state.daily = { day: T, correct: DAILY_GOAL - 1, goalReached: false };
    state.streak = { count: 5, lastDay: T - 2 };
    expect(recordAnswer(state, card, 'correct', T).state.streak.count).toBe(1);
  });

  it('neuer Tag setzt den Tageszähler zurück', () => {
    let state = createState();
    state.daily = { day: T - 1, correct: 15, goalReached: false };
    expect(recordAnswer(state, card, 'correct', T).state.daily).toEqual({ day: T, correct: 1, goalReached: false });
  });

  it('einlösen zieht Gold ab und protokolliert, nicht unter 0', () => {
    let state = createState();
    state.gold = 50;
    state.rewards = [{ id: 'r1', name: 'Minecraft-Skin', price: 40 }];
    const r = redeem(state, 'r1', T);
    expect(r.ok).toBe(true);
    expect(r.state.gold).toBe(10);
    expect(r.state.redemptions).toHaveLength(1);
    expect(redeem(r.state, 'r1', T).ok).toBe(false);
  });

  it('Import prüft das Format', () => {
    expect(validateImport(createState()).ok).toBe(true);
    expect(validateImport({ foo: 1 }).ok).toBe(false);
    expect(validateImport(null).ok).toBe(false);
  });

  it('Tagesnummer nutzt lokale Mitternacht', () => {
    const a = todayNumber(new Date(2026, 9, 10, 0, 5));
    const b = todayNumber(new Date(2026, 9, 10, 23, 55));
    const c = todayNumber(new Date(2026, 9, 11, 0, 5));
    expect(a).toBe(b);
    expect(c).toBe(a + 1);
  });
});

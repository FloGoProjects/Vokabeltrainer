// Spielstand: reine Funktionen (testbar) + Laden/Speichern in localStorage.
import { applyAnswer } from './srs.js';
import { goldForAnswer, streakBonus, DAILY_GOAL, DAILY_GOAL_GOLD } from './gold.js';

export const STATE_VERSION = 1;
const STORAGE_KEY = 'vokabeltrainer.v1';

export function todayNumber(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

export function createState() {
  return {
    version: STATE_VERSION,
    gold: 0,
    cards: {},
    daily: { day: null, correct: 0, goalReached: false },
    streak: { count: 0, lastDay: null },
    rewards: [],
    redemptions: [],
    decks: [],
    pinHash: null,
    settings: { theme: 'heft' },
  };
}

export function recordAnswer(state, card, outcome, today) {
  const before = state.cards[card.id];
  const gold = goldForAnswer(before, outcome, today);
  const after = applyAnswer(before, outcome, today);
  if (gold > 0) after.goldDay = today;

  let daily = state.daily.day === today ? { ...state.daily } : { day: today, correct: 0, goalReached: false };
  let streak = state.streak;
  let bonus = 0;
  if (outcome === 'correct') {
    daily.correct++;
    if (!daily.goalReached && daily.correct >= DAILY_GOAL) {
      daily.goalReached = true;
      const count = streak.lastDay === today - 1 ? streak.count + 1 : 1;
      streak = { count, lastDay: today };
      bonus = DAILY_GOAL_GOLD + streakBonus(count);
    }
  }

  return {
    state: { ...state, cards: { ...state.cards, [card.id]: after }, gold: state.gold + gold + bonus, daily, streak },
    gold,
    bonus,
  };
}

export function redeem(state, rewardId, today) {
  const reward = state.rewards.find((r) => r.id === rewardId);
  if (!reward) return { ok: false, error: 'Belohnung nicht gefunden', state };
  if (state.gold < reward.price) return { ok: false, error: 'Nicht genug Gold', state };
  return {
    ok: true,
    state: {
      ...state,
      gold: state.gold - reward.price,
      redemptions: [...state.redemptions, { rewardId, name: reward.name, price: reward.price, day: today }],
    },
  };
}

export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Keine gültige Datei' };
  if (obj.version !== STATE_VERSION) return { ok: false, error: 'Unbekannte Version' };
  if (typeof obj.gold !== 'number' || typeof obj.cards !== 'object' || !Array.isArray(obj.rewards)) {
    return { ok: false, error: 'Datei ist kein Vokabeltrainer-Stand' };
  }
  return { ok: true };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createState();
    const parsed = JSON.parse(raw);
    return validateImport(parsed).ok ? { ...createState(), ...parsed } : createState();
  } catch {
    return createState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

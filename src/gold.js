// Vokabel-Gold: belohnt Fortschritt, nicht Wiederholen derselben Karte.
import { isDue } from './srs.js';

export const DAILY_GOAL = 20;
export const DAILY_GOAL_GOLD = 10;
const MAX_DAYS_COUNTED = 30;

export function goldForAnswer(state, outcome, today) {
  if (outcome !== 'correct') return 0;
  if (state && (!isDue(state, today) || state.goldDay === today)) return 0;
  const days = state ? Math.min(today - state.last, MAX_DAYS_COUNTED) : 0;
  const knownTimes = state?.correct ?? 0;
  return Math.max(1, Math.round((2 + days / 3) / (1 + 0.2 * knownTimes)));
}

export function streakBonus(streakDays) {
  return Math.min(streakDays * 2, 10);
}

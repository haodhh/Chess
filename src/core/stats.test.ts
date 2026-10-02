import { describe, expect, it } from 'vitest';
import { attemptsToday, lengthStats, movesOf, ratingHistory, streakDays, themeStats, weakestThemes } from './stats';

const day = 24 * 3600_000;
const now = new Date('2026-03-10T12:00:00').getTime();
const a = (offsetDays: number, success = true, themes: string[] = [], ratingAfter?: number, ratingBefore?: number) => ({
  ts: now - offsetDays * day,
  success,
  themes,
  ratingAfter,
  ratingBefore,
});

describe('stats', () => {
  it('counts a streak ending today or yesterday', () => {
    expect(streakDays([a(0), a(1), a(2), a(4)], now)).toBe(3);
    expect(streakDays([a(1), a(2)], now)).toBe(2);
    expect(streakDays([a(2)], now)).toBe(0);
    expect(streakDays([], now)).toBe(0);
  });

  it('filters attempts made today', () => {
    expect(attemptsToday([a(0), a(0), a(1)], now)).toHaveLength(2);
  });

  it('finds the weakest skill themes', () => {
    const attempts = [
      ...Array.from({ length: 6 }, (_, i) => a(0, i < 1, ['fork', 'short'])),
      ...Array.from({ length: 6 }, (_, i) => a(0, i < 5, ['pin'])),
      ...Array.from({ length: 2 }, () => a(0, false, ['skewer'])),
    ];
    const stats = themeStats(attempts);
    expect(stats.find((s) => s.theme === 'fork')).toMatchObject({ attempts: 6, solved: 1 });
    expect(weakestThemes(stats).map((s) => s.theme)).toEqual(['fork', 'pin']);
  });

  it('builds a sorted rating history starting from the initial rating', () => {
    expect(ratingHistory([a(0, true, [], 1520, 1500), a(2, true, [], 1500, 1450), a(1)])).toEqual([
      { ts: now - 2 * day, rating: 1450 },
      { ts: now - 2 * day, rating: 1500 },
      { ts: now, rating: 1520 },
    ]);
  });
});

describe('lengthStats', () => {
  const a = (success: boolean, themes: string[], moves?: number) => ({ ts: 0, success, themes, moves });

  it('uses the recorded move count, or the Lichess length themes for older attempts', () => {
    expect(movesOf(a(true, [], 4))).toBe(4);
    expect(movesOf(a(true, ['mate', 'mateIn2']))).toBe(2);
    expect(movesOf(a(true, ['oneMove', 'fork']))).toBe(1);
    expect(movesOf(a(true, ['mateIn5']))).toBeUndefined(); // "mate in 5 or more"
    expect(movesOf(a(true, ['fork']))).toBeUndefined();
  });

  it('counts attempts and successes per move count', () => {
    const attempts = [a(true, ['mate'], 2), a(false, ['fork'], 2), a(true, ['crushing'], 3), a(false, ['fork'])];
    expect(lengthStats(attempts).get(2)).toEqual({ attempts: 2, solved: 1 });
    expect(lengthStats(attempts).get(3)).toEqual({ attempts: 1, solved: 1 });
    expect(lengthStats(attempts, true).get(2)).toEqual({ attempts: 1, solved: 1 });
    expect(lengthStats(attempts, true).has(3)).toBe(false);
  });
});

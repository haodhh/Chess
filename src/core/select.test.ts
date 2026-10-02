import { describe, expect, it } from 'vitest';
import { bandsByDistance, choosePuzzle } from './select';
import type { Puzzle } from './puzzle';

const p = (id: string, rating: number, themes: string[] = []): Puzzle => ({ id, fen: '', moves: [], rating, themes });

describe('choosePuzzle', () => {
  const pool = [p('a', 1000, ['fork']), p('b', 1210, ['pin']), p('c', 1240, ['fork']), p('d', 1600)];

  it('prefers puzzles within 50 points of the target', () => {
    for (let i = 0; i < 20; i++) {
      expect(['b', 'c']).toContain(choosePuzzle(pool, { target: 1220 })?.id);
    }
  });

  it('skips excluded puzzles and filters by theme', () => {
    expect(choosePuzzle(pool, { target: 1220, exclude: new Set(['b']) })?.id).toBe('c');
    expect(choosePuzzle(pool, { target: 1220, theme: 'fork', exclude: new Set(['c']) })?.id).toBe('a');
    expect(choosePuzzle(pool, { target: 1220, theme: 'skewer' })).toBeUndefined();
  });

  it('filters by the number of solver moves and by mate', () => {
    const long = (id: string, plies: number, themes: string[] = []): Puzzle => ({ ...p(id, 1200, themes), moves: Array(plies).fill('e2e4') });
    const mixed = [long('m1', 2, ['mate', 'mateIn1']), long('w1', 2), long('m3', 6, ['mate', 'mateIn3']), long('w3', 6, ['crushing'])];
    expect(choosePuzzle(mixed, { target: 1200, moves: 3, mateOnly: true })?.id).toBe('m3');
    expect(choosePuzzle(mixed, { target: 1200, moves: 3, exclude: new Set(['m3']) })?.id).toBe('w3');
    expect(choosePuzzle(mixed, { target: 1200, moves: 1, mateOnly: true })?.id).toBe('m1');
    expect(choosePuzzle(mixed, { target: 1200, moves: 2 })).toBeUndefined();
  });

  it('falls back to the closest puzzles when none are near', () => {
    expect(choosePuzzle([p('x', 400), p('y', 900)], { target: 2000, rng: () => 0 })?.id).toBe('y');
  });
});

describe('bandsByDistance', () => {
  it('orders bands outward from the target', () => {
    expect(bandsByDistance([400, 500, 600, 700, 800], 640).slice(0, 3)).toEqual([600, 500, 700]);
  });
});

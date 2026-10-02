import { describe, expect, it } from 'vitest';
import { bandOf, isValidPuzzle } from './build-puzzles.mjs';

describe('build-puzzles', () => {
  it('clamps ratings into 100-point bands', () => {
    expect(bandOf(350)).toBe(400);
    expect(bandOf(1499)).toBe(1400);
    expect(bandOf(1500)).toBe(1500);
    expect(bandOf(3300)).toBe(2900);
  });

  it('rejects puzzles with illegal moves', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(isValidPuzzle(start, ['e2e4', 'e7e5'])).toBe(true);
    expect(isValidPuzzle(start, ['e2e5', 'e7e5'])).toBe(false);
    expect(isValidPuzzle(start, ['e2e4'])).toBe(false);
  });
});

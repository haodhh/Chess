import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { DRILLS, starsFor } from './drills';

describe('drills', () => {
  it('have legal positions and unique ids', () => {
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
    for (const d of DRILLS) {
      expect(() => new Chess(d.fen)).not.toThrow();
      const flipped = d.fen.replace(/ ([wb]) /, (_, t) => (t === 'w' ? ' b ' : ' w '));
      expect(new Chess(flipped).inCheck(), d.id).toBe(false);
    }
  });

  it('award stars by move count', () => {
    const d = DRILLS.find((x) => x.id === 'mate-queen')!;
    expect(starsFor(d, 8)).toBe(3);
    expect(starsFor(d, 12)).toBe(2);
    expect(starsFor(d, 30)).toBe(1);
  });
});

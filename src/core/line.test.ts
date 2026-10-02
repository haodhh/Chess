import { describe, expect, it } from 'vitest';
import { LineSession } from './line';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('LineSession', () => {
  it('lets White play its moves while Black replies automatically', () => {
    const s = new LineSession(START, ['e2e4', 'e7e5', 'g1f3']);
    expect(s.isUserTurn).toBe(true);
    expect(s.tryMove('d2d4')).toBe('wrong');
    expect(s.mistakes).toBe(1);
    expect(s.tryMove('e2e4')).toBe('correct');
    expect(s.playOpponent()?.san).toBe('e5');
    expect(s.tryMove('g1f3')).toBe('done');
  });

  it('can train the second player', () => {
    const s = new LineSession(START, ['e2e4', 'c7c5'], 'b');
    expect(s.isUserTurn).toBe(false);
    s.playOpponent();
    expect(s.expected).toBe('c7c5');
    expect(s.tryMove('c7c5')).toBe('done');
  });

  it('accepts any checkmate', () => {
    const s = new LineSession('6k1/5ppp/8/8/8/8/5PPP/RQ4K1 w - - 0 1', ['b1b8']);
    expect(s.tryMove('a1a8')).toBe('done');
  });
});

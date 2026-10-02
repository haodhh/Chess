import { describe, expect, it } from 'vitest';
import { PuzzleSession, type Puzzle } from './puzzle';

// Fool's mate: the setup move is 2.g4 and the solver (Black) mates with Qh4#.
const foolsMate: Puzzle = {
  id: 'fools',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
  moves: ['g2g4', 'd8h4'],
  rating: 600,
  themes: ['mateIn1'],
};

// Synthetic knight fork: after the setup move ...Kd7, White wins the rook with Nb6+ and Nxa8.
const twoMover: Puzzle = {
  id: 'two',
  fen: 'r3k3/8/8/3N4/8/8/8/4K3 b - - 0 1',
  moves: ['e8d7', 'd5b6', 'd7c7', 'b6a8'],
  rating: 1200,
  themes: ['fork'],
};

describe('PuzzleSession', () => {
  it('plays the setup move and gives the solver the other colour', () => {
    const s = new PuzzleSession(foolsMate);
    expect(s.solverColor).toBe('black');
    expect(s.isSolverTurn).toBe(false);
    s.playScripted();
    expect(s.isSolverTurn).toBe(true);
    expect(s.expectedMove).toBe('d8h4');
  });

  it('rejects a wrong move without changing the position', () => {
    const s = new PuzzleSession(twoMover);
    s.playScripted();
    const fen = s.fen;
    expect(s.tryMove('d5c7')).toBe('wrong');
    expect(s.fen).toBe(fen);
    expect(s.tryMove('a1a2')).toBe('wrong'); // illegal
  });

  it('walks through a multi-move solution', () => {
    const s = new PuzzleSession(twoMover);
    s.playScripted();
    expect(s.tryMove('d5b6')).toBe('correct');
    expect(s.isSolverTurn).toBe(false);
    expect(s.playScripted().san).toBe('Kc7');
    expect(s.tryMove('b6a8')).toBe('solved');
    expect(s.isComplete).toBe(true);
  });

  it('accepts an alternative checkmate', () => {
    // Both Qb8# (the scripted solution) and Ra8# mate on the back rank.
    const p: Puzzle = {
      id: 'alt',
      fen: '6k1/5ppp/8/8/8/8/5PPP/RQ2K3 b - - 0 1',
      moves: ['g8h8', 'b1b8'],
      rating: 800,
      themes: ['mateIn1'],
    };
    const s = new PuzzleSession(p);
    s.playScripted();
    expect(s.tryMove('a1a8')).toBe('solved');
  });

  it('can reveal the rest of the solution', () => {
    const s = new PuzzleSession(twoMover);
    s.playScripted();
    const sans = [...s.solutionMoves()].map((m) => m.san);
    expect(sans).toEqual(['Nb6+', 'Kc7', 'Nxa8+']);
    expect(s.isComplete).toBe(true);
  });
});

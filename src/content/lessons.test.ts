import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { DRILLS } from '../data/drills';
import { LineSession } from '../core/line';
import { LESSONS } from './lessons';

const SQUARE = /^[a-h][1-8]$/;
const themeCounts: Record<string, number> = JSON.parse(readFileSync('public/data/puzzles/index.json', 'utf8')).themeCounts;
const boardOnly = (fen: string) => fen === '8/8/8/8/8/8/8/8 w - - 0 1';

/** chess.js accepts positions where the side not to move is in check; those are illegal. */
export function expectLegal(fen: string) {
  expect(() => new Chess(fen), fen).not.toThrow();
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  expect(new Chess(parts.join(' ')).inCheck(), `side not to move is in check: ${fen}`).toBe(false);
}

describe('lessons', () => {
  it('have unique ids', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  for (const lesson of LESSONS) {
    it(`${lesson.id}: every step is valid`, () => {
      for (const step of lesson.steps) {
        if ('fen' in step && step.fen && !boardOnly(step.fen)) expectLegal(step.fen);
        switch (step.kind) {
          case 'explain':
            for (const a of step.arrows ?? []) expect(a).toMatch(/^[a-h][1-8][a-h][1-8]$/);
            for (const m of step.marks ?? []) expect(m).toMatch(SQUARE);
            if (step.showMoves) expect(new Chess(step.fen).moves({ square: step.showMoves as never }).length).toBeGreaterThan(0);
            break;
          case 'move': {
            // Play the whole line: the user's moves must be accepted and the replies legal.
            const s = new LineSession(step.fen, step.line);
            while (!s.isDone) {
              if (s.isUserTurn) expect(s.tryMove(s.expected!), `${lesson.id}: ${step.line}`).not.toBe('wrong');
              else expect(s.playOpponent()).toBeDefined();
            }
            break;
          }
          case 'square':
            for (const a of step.answers) expect(a).toMatch(SQUARE);
            break;
          case 'quiz':
            expect(step.answer).toBeLessThan(step.options.length);
            break;
          case 'puzzles':
            expect(themeCounts[step.theme], step.theme).toBeGreaterThan(step.count);
            break;
          case 'link': {
            const drill = step.to.match(/^\/train\/drills\/(.+)$/)?.[1];
            if (drill) expect(DRILLS.map((d) => d.id)).toContain(drill);
            break;
          }
        }
      }
    });
  }

  it('knight squares in the pieces lesson match the legal moves', () => {
    const step = LESSONS.find((l) => l.id === 'pieces')!.steps.find((s) => s.kind === 'square')!;
    if (step.kind !== 'square') throw new Error();
    const legal = new Chess(step.fen).moves({ square: 'd4', verbose: true }).map((m) => m.to);
    expect([...step.answers].sort()).toEqual(legal.sort());
  });
});

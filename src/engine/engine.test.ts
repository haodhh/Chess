import { describe, expect, it } from 'vitest';
import { pickWeakMove } from './bot';
import { classify, moveAccuracy, reviewGame, sideAccuracy } from './review';
import { formatScore, negate, parseInfo, winPercent } from './uci';

describe('uci', () => {
  it('parses info lines with multipv, cp and mate scores', () => {
    expect(
      parseInfo('info depth 12 seldepth 15 multipv 2 score cp -34 nodes 1 nps 1 time 2 pv c7c5 g1f3'),
    ).toEqual({ multipv: 2, depth: 12, cp: -34, pv: ['c7c5', 'g1f3'] });
    expect(parseInfo('info depth 5 score mate -2 pv e1e2')).toMatchObject({ mate: -2, pv: ['e1e2'] });
    expect(parseInfo('info string NNUE evaluation')).toBeNull();
    expect(parseInfo('info depth 0 score mate 0')).toBeNull();
  });

  it('maps scores to winning chances', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50);
    expect(winPercent({ cp: 300 })).toBeGreaterThan(75);
    expect(winPercent({ mate: 3 })).toBe(100);
    expect(winPercent({ mate: -1 })).toBe(0);
    expect(winPercent(negate({ cp: 300 }))).toBeCloseTo(100 - winPercent({ cp: 300 }));
    expect(formatScore({ cp: 134 })).toBe('+1.3');
    expect(formatScore({ mate: -3 })).toBe('#-3');
  });
});

describe('review', () => {
  it('classifies by the drop in winning chances', () => {
    expect(classify(0, true)).toBe('best');
    expect(classify(1.5, false)).toBe('excellent');
    expect(classify(8, false)).toBe('inaccuracy');
    expect(classify(15, false)).toBe('mistake');
    expect(classify(40, false)).toBe('blunder');
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
    expect(moveAccuracy(30)).toBeLessThan(30);
  });

  it('reviews a game from position evaluations', () => {
    // White plays the best move; Black then blunders from equal into -5 (from Black's view).
    const reviews = reviewGame(
      ['e2e4', 'f7f6'],
      [
        { score: { cp: 30 }, best: 'e2e4' },
        { score: { cp: -30 }, best: 'e7e5' },
        { score: { cp: 500 }, best: 'd1h5' },
      ],
    );
    expect(reviews[0].cls).toBe('best');
    expect(reviews[1].cls).toBe('blunder');
    expect(sideAccuracy(reviews, 'white')).toBeGreaterThan(95);
    expect(sideAccuracy(reviews, 'black')).toBeLessThan(30);
  });

  it('marks opening moves as book', () => {
    const reviews = reviewGame(['e2e4'], [{ score: { cp: 30 }, best: 'd2d4' }, { score: { cp: -30 }, best: null }], 1);
    expect(reviews[0].cls).toBe('book');
  });
});

describe('pickWeakMove', () => {
  const lines = [
    { multipv: 1, depth: 4, cp: 50, pv: ['a'] },
    { multipv: 2, depth: 4, cp: 40, pv: ['b'] },
    { multipv: 3, depth: 4, cp: -400, pv: ['c'] },
  ];
  it('mostly prefers good moves', () => {
    let seq = 0;
    const rng = () => [0.99, 0.1][seq++ % 2];
    expect(pickWeakMove(lines, { depth: 4, multiPv: 3, temperature: 5, blunderChance: 0 }, rng)).toBe('a');
  });
  it('sometimes plays a random listed move', () => {
    const rng = () => 0;
    expect(pickWeakMove(lines, { depth: 4, multiPv: 3, temperature: 5, blunderChance: 0.5 }, rng)).toBe('b');
  });
  it('returns null without lines', () => {
    expect(pickWeakMove([], { depth: 1, multiPv: 1, temperature: 1, blunderChance: 0 })).toBeNull();
  });
});

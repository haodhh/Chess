import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { bandOf, buildPuzzles, isValidPuzzle, replayPuzzle, solverMoves } from './build-puzzles.mjs';

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

describe('move-count files', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // Knights hopping back and forth make legal lines of any length that never mate.
  const hops = (plies) => Array.from({ length: plies }, (_, i) => ['g1f3', 'g8f6', 'f3g1', 'f6g8'][i % 4]).join(' ');
  const foolsMate = 'f2f3 e7e5 g2g4 d8h4'; // Black mates in 2
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const mateIn5 = 'a7a6 f1c4 a6a5 d1f3 a5a4 b1c3 a4a3 g1e2 a3b2 f3f7'; // White mates in 5
  const header = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes';
  const row = (id, fen, moves, rating, themes, popularity = 95, plays = 1000) =>
    `${id},${fen},${moves},${rating},75,${popularity},${plays},${themes}`;

  it('counts the solver moves after the setup move', () => {
    expect(solverMoves(['a', 'b'])).toBe(1);
    expect(solverMoves(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(3);
  });

  it('checks that mates really end in checkmate', () => {
    expect(replayPuzzle(start, foolsMate.split(' '))).toEqual({ valid: true, mate: true });
    expect(replayPuzzle(afterE4, mateIn5.split(' '))).toEqual({ valid: true, mate: true });
    expect(replayPuzzle(start, hops(10).split(' '))).toEqual({ valid: true, mate: false });
  });

  it('writes long mates to their own files and counts mates per length', async () => {
    const csv = [
      header,
      // Lichess left out the mate theme here.
      row('m1', 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2', 'g2g4 d8h4', 900, 'oneMove'),
      row('fool', start, foolsMate, 1000, 'mate mateIn2 short'),
      // Tagged as a mate, but the line does not mate.
      row('fake', start, hops(10), 1800, 'mate mateIn5 veryLong'),
      row('five', afterE4, mateIn5, 1500, 'mate mateIn5 veryLong'),
      // Too unpopular for the rating shards, but fine for the rare long mates.
      row('five-rare', afterE4, mateIn5, 1600, 'mate mateIn5 veryLong', 55, 40),
    ].join('\n');
    const outDir = await mkdtemp(path.join(tmpdir(), 'puzzles-'));
    const stats = await buildPuzzles(Readable.from([csv]), { outDir });
    const index = JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8'));
    expect(index.lengths.map((l) => [l.moves, l.count, l.file])).toEqual([[5, 2, 'm05.json']]);
    expect(index.mateLengthCounts).toEqual({ 1: 1, 2: 1, 5: 2 });
    expect(stats.written).toBe(4); // 'five-rare' is only in m05.json
    const themesOf = async (file, id) => {
      const shard = JSON.parse(await readFile(path.join(outDir, file), 'utf8'));
      return shard.puzzles.find((r) => r[0] === id)[4].map((t) => index.themes[t]).sort();
    };
    expect(await themesOf('r0900.json', 'm1')).toEqual(['mate', 'oneMove']);
    expect(await themesOf('r1800.json', 'fake')).toEqual(['veryLong']);
    expect(await themesOf('m05.json', 'five-rare')).toEqual(['mate', 'mateIn5', 'veryLong']);
    await rm(outDir, { recursive: true });
  });
});

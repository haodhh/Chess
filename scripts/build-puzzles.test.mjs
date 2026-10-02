import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { bandOf, buildPuzzles, isValidPuzzle, solverMoves } from './build-puzzles.mjs';

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
  // Knights hopping back and forth make legal "solutions" of any length.
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const hops = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const line = (plies) => Array.from({ length: plies }, (_, i) => hops[i % 4]).join(' ');
  const header = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes';
  const row = (id, plies, rating, themes, popularity = 95, plays = 1000) =>
    `${id},${start},${line(plies)},${rating},75,${popularity},${plays},${themes}`;

  it('counts the solver moves after the setup move', () => {
    expect(solverMoves(['a', 'b'])).toBe(1);
    expect(solverMoves(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(3);
  });

  it('writes long puzzles to their own files and counts every length', async () => {
    const csv = [
      header,
      row('one', 2, 900, 'mate mateIn1 oneMove'),
      row('two', 4, 1200, 'fork short'),
      row('five', 10, 1800, 'mate mateIn5 veryLong'),
      // Too unpopular for the rating shards, but fine for the rare long puzzles.
      row('seven', 14, 2100, 'crushing veryLong', 65, 150),
      row('eleven', 22, 2300, 'mate veryLong'),
    ].join('\n');
    const outDir = await mkdtemp(path.join(tmpdir(), 'puzzles-'));
    const stats = await buildPuzzles(Readable.from([csv]), { outDir });
    const index = JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8'));
    expect(index.lengths.map((l) => [l.moves, l.count, l.file])).toEqual([
      [5, 1, 'm05.json'],
      [7, 1, 'm07.json'],
    ]);
    expect(index.lengthCounts).toEqual({ 1: 1, 2: 1, 5: 1, 7: 1 });
    expect(index.mateLengthCounts).toEqual({ 1: 1, 5: 1 });
    expect(stats.written).toBe(4); // 'seven' is only in its move-count file
    const seven = JSON.parse(await readFile(path.join(outDir, 'm07.json'), 'utf8'));
    expect(seven.puzzles[0][0]).toBe('seven');
    expect(index.themes[seven.puzzles[0][4][0]]).toBe('crushing');
    await rm(outDir, { recursive: true });
  });
});

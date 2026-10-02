#!/usr/bin/env node
// Builds the puzzle shards in public/data/puzzles from the Lichess puzzle database (CC0).
//
// Usage:
//   curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | node scripts/build-puzzles.mjs
//   node scripts/build-puzzles.mjs path/to/lichess_db_puzzle.csv
//
// Besides the rating shards, puzzles that take LONG_MIN..LONG_MAX of the solver's moves are
// rare, so they get their own reservoirs (with looser popularity filters) and one file per
// move count (m05.json … m10.json).
//
// Environment overrides: PER_BAND, MIN_POPULARITY, MIN_PLAYS, MAX_RD, PER_LENGTH, PER_LENGTH_MATE,
// LONG_MIN_POPULARITY, LONG_MIN_PLAYS, LONG_MAX_RD, OUT_DIR, SEED.

import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { Chess } from 'chess.js';

const PER_BAND = Number(process.env.PER_BAND ?? 2500);
const MIN_POPULARITY = Number(process.env.MIN_POPULARITY ?? 80);
const MIN_PLAYS = Number(process.env.MIN_PLAYS ?? 300);
const MAX_RD = Number(process.env.MAX_RD ?? 90);
const PER_LENGTH = Number(process.env.PER_LENGTH ?? 600);
const PER_LENGTH_MATE = Number(process.env.PER_LENGTH_MATE ?? 300);
const LONG_MIN_POPULARITY = Number(process.env.LONG_MIN_POPULARITY ?? 60);
const LONG_MIN_PLAYS = Number(process.env.LONG_MIN_PLAYS ?? 100);
const LONG_MAX_RD = Number(process.env.LONG_MAX_RD ?? 110);
const OUT_DIR = process.env.OUT_DIR ?? path.join('public', 'data', 'puzzles');
const SEED = Number(process.env.SEED ?? 20261002);

export const BAND_MIN = 400;
export const BAND_MAX = 2900;
export const BAND_SIZE = 100;
/** Move counts (the solver's moves) that get their own files. */
export const LONG_MIN = 5;
export const LONG_MAX = 10;

/** The number of moves the solver plays: the first move is the opponent's setup move. */
export function solverMoves(moves) {
  return Math.floor(moves.length / 2);
}

export function bandOf(rating) {
  const b = Math.floor(rating / BAND_SIZE) * BAND_SIZE;
  return Math.min(BAND_MAX, Math.max(BAND_MIN, b));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isValidPuzzle(fen, moves) {
  try {
    const chess = new Chess(fen);
    for (const uci of moves) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return moves.length >= 2;
  } catch {
    return false;
  }
}

/** Keeps a uniform random sample of `size` items (reservoir sampling). */
function offer(res, item, size, rand) {
  res.seen++;
  if (res.items.length < size) {
    res.items.push(item);
  } else {
    const j = Math.floor(rand() * res.seen);
    if (j < size) res.items[j] = item;
  }
}

export async function buildPuzzles(input, { outDir = OUT_DIR } = {}) {
  const rand = mulberry32(SEED);
  const reservoirs = new Map(); // band -> { seen, items }
  const longAll = new Map(); // move count -> { seen, items }
  const longMate = new Map(); // move count -> { seen, items }, mates only
  const rl = createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let total = 0;
  let kept = 0;

  for await (const line of rl) {
    if (!line) continue;
    const cols = line.split(',');
    if (!header) {
      header = Object.fromEntries(cols.map((name, i) => [name.trim(), i]));
      for (const required of ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Themes']) {
        if (!(required in header)) throw new Error(`Missing column ${required}`);
      }
      continue;
    }
    total++;
    const get = (name) => (name in header ? cols[header[name]] : undefined);
    const rating = Number(get('Rating'));
    const popularity = Number(get('Popularity') ?? 100);
    const plays = Number(get('NbPlays') ?? MIN_PLAYS);
    const rd = Number(get('RatingDeviation') ?? 0);
    if (!Number.isFinite(rating)) continue;
    const item = {
      id: get('PuzzleId'),
      fen: get('FEN'),
      moves: get('Moves').trim().split(' '),
      rating: Math.round(rating),
      themes: (get('Themes') ?? '').trim().split(' ').filter(Boolean),
    };

    const n = solverMoves(item.moves);
    if (n >= LONG_MIN && n <= LONG_MAX && popularity >= LONG_MIN_POPULARITY && plays >= LONG_MIN_PLAYS && rd <= LONG_MAX_RD) {
      for (const [map, size, ok] of [
        [longAll, PER_LENGTH, true],
        [longMate, PER_LENGTH_MATE, item.themes.includes('mate')],
      ]) {
        if (!ok) continue;
        let res = map.get(n);
        if (!res) map.set(n, (res = { seen: 0, items: [] }));
        offer(res, item, size, rand);
      }
    }

    if (popularity < MIN_POPULARITY || plays < MIN_PLAYS || rd > MAX_RD) continue;
    kept++;
    const band = bandOf(rating);
    let res = reservoirs.get(band);
    if (!res) reservoirs.set(band, (res = { seen: 0, items: [] }));
    offer(res, item, PER_BAND, rand);
  }

  const themeCounts = new Map();
  const countThemes = (puzzles) => {
    for (const p of puzzles) for (const t of p.themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  };
  const byRating = (a, b) => a.rating - b.rating || a.id.localeCompare(b.id);
  const bands = [];
  for (const [band, res] of [...reservoirs.entries()].sort((a, b) => a[0] - b[0])) {
    const valid = res.items.filter((p) => isValidPuzzle(p.fen, p.moves)).sort(byRating);
    countThemes(valid);
    bands.push({ band, puzzles: valid });
  }
  const lengths = [];
  for (let n = LONG_MIN; n <= LONG_MAX; n++) {
    const unique = new Map();
    for (const p of [...(longAll.get(n)?.items ?? []), ...(longMate.get(n)?.items ?? [])]) unique.set(p.id, p);
    const valid = [...unique.values()].filter((p) => isValidPuzzle(p.fen, p.moves)).sort(byRating);
    lengths.push({ moves: n, puzzles: valid });
  }
  // themeCounts describes the rating shards (theme training); themes only seen in the move-count files go last.
  const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  for (const { puzzles } of lengths) for (const p of puzzles) for (const t of p.themes) if (!themes.includes(t)) themes.push(t);
  const themeIndex = new Map(themes.map((t, i) => [t, i]));
  const toRow = (p) => [p.id, p.fen, p.moves.join(' '), p.rating, p.themes.map((t) => themeIndex.get(t))];

  await mkdir(outDir, { recursive: true });
  for (const f of await readdir(outDir)) {
    if (f.endsWith('.json')) await rm(path.join(outDir, f));
  }
  const bandMeta = [];
  // Puzzles available for each move count: the rating shards below LONG_MIN, the move-count files from it on.
  const lengthCounts = {};
  const mateLengthCounts = {};
  const tally = (p) => {
    const n = solverMoves(p.moves);
    if (n > LONG_MAX) return;
    lengthCounts[n] = (lengthCounts[n] ?? 0) + 1;
    if (p.themes.includes('mate')) mateLengthCounts[n] = (mateLengthCounts[n] ?? 0) + 1;
  };
  for (const { band, puzzles } of bands) {
    if (puzzles.length === 0) continue;
    const file = `r${String(band).padStart(4, '0')}.json`;
    await writeFile(path.join(outDir, file), JSON.stringify({ band, puzzles: puzzles.map(toRow) }));
    bandMeta.push({ band, count: puzzles.length, file });
    for (const p of puzzles) if (solverMoves(p.moves) < LONG_MIN) tally(p);
  }
  const lengthMeta = [];
  for (const { moves, puzzles } of lengths) {
    if (puzzles.length === 0) continue;
    const file = `m${String(moves).padStart(2, '0')}.json`;
    await writeFile(path.join(outDir, file), JSON.stringify({ moves, puzzles: puzzles.map(toRow) }));
    lengthMeta.push({ moves, count: puzzles.length, file });
    for (const p of puzzles) tally(p);
  }
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'Lichess puzzle database (https://database.lichess.org/#puzzles), CC0',
    bandSize: BAND_SIZE,
    total: bandMeta.reduce((s, b) => s + b.count, 0),
    bands: bandMeta,
    lengths: lengthMeta,
    lengthCounts,
    mateLengthCounts,
    themes,
    themeCounts: Object.fromEntries(themeCounts),
  };
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));
  return { total, kept, written: index.total, bands: bandMeta.length, themes: themes.length, lengthCounts, mateLengthCounts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const input = file ? createReadStream(file) : process.stdin;
  const stats = await buildPuzzles(input);
  console.log(
    `Read ${stats.total} puzzles, ${stats.kept} passed filters, wrote ${stats.written} ` +
      `in ${stats.bands} bands (${stats.themes} themes) to ${OUT_DIR}`,
  );
  console.log('Puzzles per move count:', stats.lengthCounts, 'mates:', stats.mateLengthCounts);
}

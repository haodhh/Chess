#!/usr/bin/env node
// Builds the puzzle shards in public/data/puzzles from the Lichess puzzle database (CC0).
//
// Usage:
//   curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | node scripts/build-puzzles.mjs
//   node scripts/build-puzzles.mjs path/to/lichess_db_puzzle.csv
//
// Environment overrides: PER_BAND, MIN_POPULARITY, MIN_PLAYS, MAX_RD, OUT_DIR, SEED.

import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { Chess } from 'chess.js';

const PER_BAND = Number(process.env.PER_BAND ?? 2500);
const MIN_POPULARITY = Number(process.env.MIN_POPULARITY ?? 80);
const MIN_PLAYS = Number(process.env.MIN_PLAYS ?? 300);
const MAX_RD = Number(process.env.MAX_RD ?? 90);
const OUT_DIR = process.env.OUT_DIR ?? path.join('public', 'data', 'puzzles');
const SEED = Number(process.env.SEED ?? 20261002);

export const BAND_MIN = 400;
export const BAND_MAX = 2900;
export const BAND_SIZE = 100;

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

export async function buildPuzzles(input) {
  const rand = mulberry32(SEED);
  const reservoirs = new Map(); // band -> { seen, items }
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
    if (!Number.isFinite(rating) || popularity < MIN_POPULARITY || plays < MIN_PLAYS || rd > MAX_RD) {
      continue;
    }
    kept++;
    const band = bandOf(rating);
    let res = reservoirs.get(band);
    if (!res) reservoirs.set(band, (res = { seen: 0, items: [] }));
    res.seen++;
    const item = {
      id: get('PuzzleId'),
      fen: get('FEN'),
      moves: get('Moves').trim().split(' '),
      rating: Math.round(rating),
      themes: (get('Themes') ?? '').trim().split(' ').filter(Boolean),
    };
    if (res.items.length < PER_BAND) {
      res.items.push(item);
    } else {
      const j = Math.floor(rand() * res.seen);
      if (j < PER_BAND) res.items[j] = item;
    }
  }

  const themeCounts = new Map();
  const bands = [];
  for (const [band, res] of [...reservoirs.entries()].sort((a, b) => a[0] - b[0])) {
    const valid = res.items.filter((p) => isValidPuzzle(p.fen, p.moves));
    valid.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
    for (const p of valid) for (const t of p.themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    bands.push({ band, puzzles: valid });
  }
  const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const themeIndex = new Map(themes.map((t, i) => [t, i]));

  await mkdir(OUT_DIR, { recursive: true });
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith('.json')) await rm(path.join(OUT_DIR, f));
  }
  const bandMeta = [];
  for (const { band, puzzles } of bands) {
    if (puzzles.length === 0) continue;
    const file = `r${String(band).padStart(4, '0')}.json`;
    const rows = puzzles.map((p) => [p.id, p.fen, p.moves.join(' '), p.rating, p.themes.map((t) => themeIndex.get(t))]);
    await writeFile(path.join(OUT_DIR, file), JSON.stringify({ band, puzzles: rows }));
    bandMeta.push({ band, count: puzzles.length, file });
  }
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'Lichess puzzle database (https://database.lichess.org/#puzzles), CC0',
    bandSize: BAND_SIZE,
    total: bandMeta.reduce((s, b) => s + b.count, 0),
    bands: bandMeta,
    themes,
    themeCounts: Object.fromEntries(themeCounts),
  };
  await writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 1));
  return { total, kept, written: index.total, bands: bandMeta.length, themes: themes.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const input = file ? createReadStream(file) : process.stdin;
  const stats = await buildPuzzles(input);
  console.log(
    `Read ${stats.total} puzzles, ${stats.kept} passed filters, wrote ${stats.written} ` +
      `in ${stats.bands} bands (${stats.themes} themes) to ${OUT_DIR}`,
  );
}

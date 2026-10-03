import type { Puzzle } from '../core/puzzle';
import { bandsByDistance, choosePuzzle, hashString, type SelectOptions } from '../core/select';

export interface PuzzleIndex {
  total: number;
  bandSize: number;
  bands: { band: number; count: number; file: string }[];
  /** Long mates are rare in the rating shards, so each long move count has its own file of mates. */
  lengths?: { moves: number; count: number; file: string }[];
  /** Mates available for each number of solver moves. */
  mateLengthCounts?: Record<string, number>;
  themes: string[];
  themeCounts: Record<string, number>;
}

/** The longest solutions offered when picking puzzles by move count. */
export const MAX_MOVES = 10;

type Row = [id: string, fen: string, moves: string, rating: number, themes: number[]];

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/puzzles/${file}`;

let indexPromise: Promise<PuzzleIndex> | undefined;
const shardCache = new Map<string, Promise<Puzzle[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

export function loadIndex(): Promise<PuzzleIndex> {
  indexPromise ??= fetchJson<PuzzleIndex>(dataUrl('index.json')).catch((e) => {
    indexPromise = undefined;
    throw e;
  });
  return indexPromise;
}

function loadShard(file: string): Promise<Puzzle[]> {
  let cached = shardCache.get(file);
  if (!cached) {
    cached = (async () => {
      const index = await loadIndex();
      const shard = await fetchJson<{ puzzles: Row[] }>(dataUrl(file));
      return shard.puzzles.map(([id, fen, moves, rating, themes]) => ({
        id,
        fen,
        moves: moves.split(' '),
        rating,
        themes: themes.map((t) => index.themes[t]),
      }));
    })();
    cached.catch(() => shardCache.delete(file));
    shardCache.set(file, cached);
  }
  return cached;
}

export async function loadBand(band: number): Promise<Puzzle[]> {
  const meta = (await loadIndex()).bands.find((b) => b.band === band);
  return meta ? loadShard(meta.file) : [];
}

/**
 * Finds a puzzle near the target rating, searching outward through the rating bands.
 * If every matching puzzle has been excluded, exclusions are ignored.
 */
export async function findPuzzle(opts: SelectOptions & { maxDistance?: number }): Promise<Puzzle | undefined> {
  const index = await loadIndex();
  const lengthFile = opts.moves !== undefined && index.lengths?.find((l) => l.moves === opts.moves)?.file;
  if (lengthFile) {
    const pool = await loadShard(lengthFile);
    return choosePuzzle(pool, opts) ?? choosePuzzle(pool, { ...opts, exclude: undefined });
  }
  const maxDistance = opts.maxDistance ?? Infinity;
  const bands = bandsByDistance(
    index.bands.map((b) => b.band),
    opts.target,
  ).filter((b) => Math.abs(b + 50 - opts.target) <= maxDistance + 50);
  for (const withExclusions of [true, false]) {
    for (const band of bands) {
      const found = choosePuzzle(await loadBand(band), withExclusions ? opts : { ...opts, exclude: undefined });
      if (found) return found;
    }
  }
  return undefined;
}

/** The same puzzle for everyone on a given day, rated around 1500. */
export async function dailyPuzzle(date: string): Promise<Puzzle | undefined> {
  const h = hashString(date);
  const index = await loadIndex();
  const bands = index.bands.map((b) => b.band).filter((b) => b >= 1200 && b <= 1800);
  if (bands.length === 0) return undefined;
  const puzzles = await loadBand(bands[h % bands.length]);
  return puzzles[(h >>> 8) % puzzles.length];
}

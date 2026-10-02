import { isMatePuzzle, solverMoves, type Puzzle } from './puzzle';

export interface SelectOptions {
  target: number;
  exclude?: Set<string>;
  theme?: string;
  /** Only puzzles whose solution takes exactly this many of the solver's moves. */
  moves?: number;
  /** Only puzzles that end in checkmate. */
  mateOnly?: boolean;
  rng?: () => number;
}

export function matchesFilter(p: Puzzle, opts: Pick<SelectOptions, 'theme' | 'moves' | 'mateOnly'>): boolean {
  return (
    (!opts.theme || p.themes.includes(opts.theme)) &&
    (opts.moves === undefined || solverMoves(p) === opts.moves) &&
    (!opts.mateOnly || isMatePuzzle(p))
  );
}

/** Picks a random puzzle close to the target rating from `candidates`. */
export function choosePuzzle(candidates: Puzzle[], opts: SelectOptions): Puzzle | undefined {
  const rng = opts.rng ?? Math.random;
  const pool = candidates.filter((p) => !opts.exclude?.has(p.id) && matchesFilter(p, opts));
  if (pool.length === 0) return undefined;
  const near = pool.filter((p) => Math.abs(p.rating - opts.target) <= 50);
  if (near.length > 0) return near[Math.floor(rng() * near.length)];
  const sorted = [...pool].sort((a, b) => Math.abs(a.rating - opts.target) - Math.abs(b.rating - opts.target));
  const closest = sorted.slice(0, 20);
  return closest[Math.floor(rng() * closest.length)];
}

/** Bands ordered by distance from the band containing `target`. */
export function bandsByDistance(bands: number[], target: number): number[] {
  return [...bands].sort((a, b) => Math.abs(a + 50 - target) - Math.abs(b + 50 - target) || a - b);
}

/** A deterministic 32-bit hash, used to pick the daily puzzle. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

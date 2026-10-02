import { useLiveQuery } from 'dexie-react-hooks';
import { decayRd, updateGlicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import type { Card } from 'ts-fsrs';
import { gradeFor, reviveCard, scheduleReview } from '../core/srs';
import { db, type Attempt, type Profile, type PuzzleMode, type ReviewCard, type RushRun, type Settings } from './db';

/** Deviation used for every puzzle when updating the player's rating. */
const PUZZLE_RD = 80;
const DAY = 24 * 3600_000;

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'green',
  sound: true,
  coordinates: true,
  animation: true,
  difficulty: 0,
  dailyGoal: 20,
};

export function defaultProfile(now = Date.now()): Profile {
  return {
    id: 'me',
    rating: { rating: 1200, rd: 300, vol: 0.06 },
    ratedAt: now,
    createdAt: now,
    onboarded: false,
    settings: DEFAULT_SETTINGS,
  };
}

export async function getProfile(): Promise<Profile> {
  const p = await db.profile.get('me');
  return p ? { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } } : defaultProfile();
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(getProfile);
}

/** The player's current rating, with deviation grown for the days since the last rated puzzle. */
export function currentRating(profile: Profile, now = Date.now()) {
  return decayRd(profile.rating, Math.floor((now - profile.ratedAt) / DAY));
}

/** Starts the puzzle rating at a self-reported level; the deviation is lower than for an unknown player. */
export async function startWithLevel(rating: number) {
  const p = await getProfile();
  await db.profile.put({ ...p, rating: { rating, rd: 200, vol: 0.06 }, ratedAt: Date.now(), onboarded: true });
}

/** Shows the level picker again; the next pick resets the puzzle rating. */
export async function chooseLevelAgain() {
  const p = await getProfile();
  await db.profile.put({ ...p, onboarded: false });
}

export async function updateSettings(patch: Partial<Settings>) {
  const p = await getProfile();
  await db.profile.put({ ...p, settings: { ...p.settings, ...patch } });
}

export interface AttemptInput {
  puzzle: Puzzle;
  mode: PuzzleMode;
  success: boolean;
  usedHint: boolean;
  timeMs: number;
  /** Whether the result updates the player's puzzle rating. */
  rated: boolean;
}

export interface AttemptResult {
  ratingBefore?: number;
  ratingAfter?: number;
}

/** Stores an attempt, updates the rating when rated, and schedules failed puzzles for review. */
export async function recordAttempt(input: AttemptInput): Promise<AttemptResult> {
  const { puzzle, mode, success, usedHint, timeMs, rated } = input;
  const solved = success && !usedHint;
  return db.transaction('rw', db.profile, db.attempts, db.reviews, async () => {
    const now = Date.now();
    const result: AttemptResult = {};
    if (rated) {
      const profile = await getProfile();
      const before = currentRating(profile, now);
      const after = updateGlicko(before, { rating: puzzle.rating, rd: PUZZLE_RD }, solved ? 1 : 0);
      await db.profile.put({ ...profile, rating: after, ratedAt: now });
      result.ratingBefore = Math.round(before.rating);
      result.ratingAfter = Math.round(after.rating);
    }
    await db.attempts.add({
      puzzleId: puzzle.id,
      ts: now,
      mode,
      success: solved,
      usedHint,
      timeMs,
      puzzleRating: puzzle.rating,
      themes: puzzle.themes,
      ...result,
    });

    const existing = await db.reviews.get(puzzle.id);
    if (!solved || (existing && mode === 'review')) {
      const card = scheduleReview(existing?.card, gradeFor(solved, timeMs), new Date(now));
      await db.reviews.put({
        puzzleId: puzzle.id,
        puzzle,
        card,
        due: card.due.getTime(),
        addedAt: existing?.addedAt ?? now,
      });
    }
    return result;
  });
}

export async function attemptedIds(): Promise<Set<string>> {
  const keys = await db.attempts.orderBy('puzzleId').uniqueKeys();
  return new Set(keys as string[]);
}

export function useAttempts(): Attempt[] | undefined {
  return useLiveQuery(() => db.attempts.orderBy('ts').toArray());
}

export function useDueCount(now: number): number | undefined {
  return useLiveQuery(() => db.reviews.where('due').belowOrEqual(now).count(), [now]);
}

export function useReviews(): ReviewCard[] | undefined {
  return useLiveQuery(() => db.reviews.orderBy('due').toArray());
}

export async function nextDueReview(now = Date.now()): Promise<ReviewCard | undefined> {
  return db.reviews.where('due').belowOrEqual(now).first();
}

export async function removeReview(puzzleId: string) {
  await db.reviews.delete(puzzleId);
}

export async function saveRushRun(run: Omit<RushRun, 'id'>) {
  await db.rushRuns.add(run);
}

export function useRushBest(): Record<string, number> | undefined {
  return useLiveQuery(async () => {
    const best: Record<string, number> = {};
    await db.rushRuns.each((r) => {
      best[r.mode] = Math.max(best[r.mode] ?? 0, r.score);
    });
    return best;
  });
}

// ---------- Backup ----------

const BACKUP_TABLES = [
  'profile',
  'attempts',
  'reviews',
  'rushRuns',
  'games',
  'drillResults',
  'visionRuns',
  'repertoire',
  'lessons',
] as const;

interface Backup {
  app: 'chess-trainer';
  version: number;
  exportedAt: string;
  tables: Partial<Record<(typeof BACKUP_TABLES)[number], unknown[]>>;
}

export async function exportBackup(): Promise<string> {
  const tables: Backup['tables'] = {};
  for (const name of BACKUP_TABLES) tables[name] = await db.table(name).toArray();
  const backup: Backup = { app: 'chess-trainer', version: 2, exportedAt: new Date().toISOString(), tables };
  return JSON.stringify(backup);
}

type LegacyBackup = { profile?: Profile; attempts?: Attempt[]; reviews?: ReviewCard[]; rushRuns?: RushRun[] };

export async function importBackup(json: string) {
  const data = JSON.parse(json) as Backup & LegacyBackup;
  if (data.app !== 'chess-trainer') throw new Error('File không phải bản sao lưu của ứng dụng này.');
  // Version 1 backups stored the four puzzle tables at the top level.
  const tables: Backup['tables'] = data.tables ?? {
    profile: data.profile ? [data.profile] : [],
    attempts: data.attempts ?? [],
    reviews: data.reviews ?? [],
    rushRuns: data.rushRuns ?? [],
  };
  const revive = (rows: unknown[]) =>
    rows.map((r) => {
      const row = r as { card?: Card };
      return row.card ? { ...row, card: reviveCard(row.card) } : row;
    });
  await db.transaction('rw', BACKUP_TABLES.map((n) => db.table(n)), async () => {
    for (const name of BACKUP_TABLES) {
      await db.table(name).clear();
      const rows = tables[name];
      if (rows?.length) await db.table(name).bulkPut(revive(rows));
    }
  });
}

export async function resetAll() {
  await Promise.all(BACKUP_TABLES.map((n) => db.table(n).clear()));
}

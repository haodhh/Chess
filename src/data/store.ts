import { useLiveQuery } from 'dexie-react-hooks';
import { decayRd, updateGlicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import type { Card } from 'ts-fsrs';
import { naturalKey, RESET_AT, SYNC_TABLES, TOMBSTONES, type Row, type TableName, type Tables } from './merge';
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

/**
 * Asks the browser not to evict our IndexedDB data under storage pressure.
 * Returns whether storage is persistent (false if unsupported or refused).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** Starts the puzzle rating at a self-reported level; the deviation is lower than for an unknown player. */
export async function startWithLevel(rating: number) {
  void requestPersistentStorage();
  const p = await getProfile();
  const now = Date.now();
  await db.profile.put({ ...p, rating: { rating, rd: 200, vol: 0.06 }, ratedAt: now, onboarded: true, updatedAt: now });
}

/** Shows the level picker again; the next pick resets the puzzle rating. */
export async function chooseLevelAgain() {
  const p = await getProfile();
  await db.profile.put({ ...p, onboarded: false, updatedAt: Date.now() });
}

export async function updateSettings(patch: Partial<Settings>) {
  const p = await getProfile();
  await db.profile.put({ ...p, settings: { ...p.settings, ...patch }, updatedAt: Date.now() });
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
      await db.profile.put({ ...profile, rating: after, ratedAt: now, updatedAt: now });
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
  await markDeleted('reviews', { puzzleId });
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

// ---------- Backup, sync bookkeeping ----------

/** Remembers that a record was deleted, so syncing does not bring it back. */
export async function markDeleted(table: TableName, row: Row) {
  const key = naturalKey(table, row);
  await db.transaction('rw', db.kv, async () => {
    const prev = ((await db.kv.get(TOMBSTONES))?.value as Record<string, number>) ?? {};
    const now = Date.now();
    await db.kv.put({ key: TOMBSTONES, value: { ...prev, [key]: now }, updatedAt: now });
  });
}

export async function exportTables(): Promise<Tables> {
  const tables: Tables = {};
  for (const name of SYNC_TABLES) tables[name] = (await db.table(name).toArray()) as Row[];
  return tables;
}

/** Replaces all local data with `tables`, restoring Date fields lost in JSON. */
export async function replaceTables(tables: Tables) {
  const revive = (rows: Row[]) =>
    rows.map((row) => (row.card ? { ...row, card: reviveCard(row.card as Card) } : row));
  await db.transaction('rw', SYNC_TABLES.map((n) => db.table(n)), async () => {
    for (const name of SYNC_TABLES) {
      await db.table(name).clear();
      const rows = tables[name];
      if (rows?.length) await db.table(name).bulkAdd(revive(rows));
    }
  });
}

interface Backup {
  app: 'chess-trainer';
  version: number;
  exportedAt: string;
  tables: Tables;
}

export async function exportBackup(): Promise<string> {
  const backup: Backup = { app: 'chess-trainer', version: 3, exportedAt: new Date().toISOString(), tables: await exportTables() };
  return JSON.stringify(backup);
}

type LegacyBackup = { profile?: Profile; attempts?: Attempt[]; reviews?: ReviewCard[]; rushRuns?: RushRun[] };

/** Parses a backup file (any version) into tables. */
export function parseBackup(json: string): Tables {
  const data = JSON.parse(json) as Backup & LegacyBackup;
  if (data.app !== 'chess-trainer') throw new Error('File không phải bản sao lưu của ứng dụng này.');
  // Version 1 backups stored the four puzzle tables at the top level.
  return (
    data.tables ?? {
      profile: data.profile ? [data.profile as unknown as Row] : [],
      attempts: (data.attempts ?? []) as unknown as Row[],
      reviews: (data.reviews ?? []) as unknown as Row[],
      rushRuns: (data.rushRuns ?? []) as unknown as Row[],
    }
  );
}

export async function importBackup(json: string) {
  await replaceTables(parseBackup(json));
}

/** Deletes everything; with online sync the reset also applies to the online copy. */
export async function resetAll() {
  const now = Date.now();
  await db.transaction('rw', SYNC_TABLES.map((n) => db.table(n)), async () => {
    for (const name of SYNC_TABLES) await db.table(name).clear();
    await db.kv.put({ key: RESET_AT, value: now, updatedAt: now });
  });
}

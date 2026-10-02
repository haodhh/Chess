import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle } from '../core/puzzle';
import { scheduleReview } from '../core/srs';
import { Rating } from 'ts-fsrs';
import type { Row } from './merge';
import { markDeleted } from './store';
import { db, type DrillResult, type GameAnalysis, type SavedGame, type VisionRun } from './db';

export async function saveGame(game: Omit<SavedGame, 'id'>): Promise<number> {
  return (await db.games.add(game))!;
}

export function useGames(): SavedGame[] | undefined {
  return useLiveQuery(() => db.games.orderBy('ts').reverse().toArray());
}

export function useGame(id: number): SavedGame | undefined | null {
  return useLiveQuery(async () => (await db.games.get(id)) ?? null, [id]);
}

export async function saveAnalysis(id: number, analysis: GameAnalysis) {
  await db.games.update(id, { analysis });
}

export async function deleteGame(id: number) {
  const game = await db.games.get(id);
  if (game) await markDeleted('games', game as unknown as Row);
  await db.games.delete(id);
}

/** Adds a position from the user's own game to the review queue, due now. */
export async function addPersonalPuzzle(puzzle: Puzzle): Promise<boolean> {
  if (await db.reviews.get(puzzle.id)) return false;
  const now = new Date();
  const card = scheduleReview(undefined, Rating.Again, now);
  await db.reviews.put({ puzzleId: puzzle.id, puzzle, card, due: now.getTime(), addedAt: now.getTime() });
  return true;
}

export async function saveDrillResult(r: DrillResult) {
  const prev = await db.drillResults.get(r.drillId);
  if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.bestMoves < prev.bestMoves)) {
    await db.drillResults.put(r);
  }
}

export function useDrillResults(): Map<string, DrillResult> | undefined {
  return useLiveQuery(async () => new Map((await db.drillResults.toArray()).map((r) => [r.drillId, r])));
}

export async function saveVisionRun(run: Omit<VisionRun, 'id'>) {
  await db.visionRuns.add(run);
}

export function useVisionBest(): Record<string, number> | undefined {
  return useLiveQuery(async () => {
    const best: Record<string, number> = {};
    await db.visionRuns.each((r) => {
      const key = `${r.mode}-${r.color}`;
      best[key] = Math.max(best[key] ?? 0, r.score);
    });
    return best;
  });
}

export interface OngoingBotGame {
  levelId: string;
  userColor: 'white' | 'black';
  moves: string[];
}

const ONGOING = 'ongoingBotGame';

export function useOngoingBotGame(): OngoingBotGame | null | undefined {
  return useLiveQuery(async () => ((await db.kv.get(ONGOING))?.value as OngoingBotGame | undefined) ?? null);
}

export async function saveOngoingBotGame(game: OngoingBotGame) {
  await db.kv.put({ key: ONGOING, value: game, updatedAt: Date.now() });
}

export async function clearOngoingBotGame() {
  // Kept as an empty value rather than deleted, so the clear also reaches other devices.
  await db.kv.put({ key: ONGOING, value: null, updatedAt: Date.now() });
}

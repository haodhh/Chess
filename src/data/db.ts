import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { Glicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';

export type PuzzleMode = 'rated' | 'theme' | 'rush' | 'review' | 'daily';
export type RushMode = '3m' | '5m' | 'survival';
export type BoardTheme = 'green' | 'brown' | 'blue' | 'purple';

export interface Settings {
  boardTheme: BoardTheme;
  sound: boolean;
  coordinates: boolean;
  animation: boolean;
  /** Offset added to the player's rating when picking rated puzzles. */
  difficulty: number;
  dailyGoal: number;
}

export interface Profile {
  id: 'me';
  rating: Glicko;
  /** Timestamp of the last rated attempt, for deviation decay. */
  ratedAt: number;
  createdAt: number;
  onboarded: boolean;
  settings: Settings;
}

export interface Attempt {
  id?: number;
  puzzleId: string;
  ts: number;
  mode: PuzzleMode;
  success: boolean;
  usedHint: boolean;
  timeMs: number;
  puzzleRating: number;
  themes: string[];
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface ReviewCard {
  puzzleId: string;
  puzzle: Puzzle;
  card: Card;
  /** Copy of card.due as a timestamp, for indexing. */
  due: number;
  addedAt: number;
}

export interface RushRun {
  id?: number;
  mode: RushMode;
  score: number;
  ts: number;
  puzzles: { id: string; rating: number; success: boolean }[];
}

export const db = new Dexie('chess-trainer') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  reviews: EntityTable<ReviewCard, 'puzzleId'>;
  rushRuns: EntityTable<RushRun, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  attempts: '++id, puzzleId, ts, mode',
  reviews: 'puzzleId, due',
  rushRuns: '++id, mode, ts, score',
});

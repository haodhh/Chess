import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { Glicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import type { PositionEval } from '../engine/review';

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

export type GameSource = 'bot' | 'pgn' | 'chesscom' | 'lichess';

export interface GameAnalysis {
  depth: number;
  /** Engine evaluation of every position, from the side to move. */
  positions: PositionEval[];
  bookPlies: number;
  accuracy: { white: number; black: number };
}

export interface SavedGame {
  id?: number;
  ts: number;
  source: GameSource;
  pgn: string;
  white: string;
  black: string;
  result: string;
  /** The side the user played, used for review and personal puzzles. */
  userColor: 'white' | 'black';
  /** Game id on chess.com/Lichess, to avoid importing twice. */
  externalId?: string;
  analysis?: GameAnalysis;
}

export interface DrillResult {
  drillId: string;
  stars: number;
  bestMoves: number;
  ts: number;
}

export interface VisionRun {
  id?: number;
  mode: string;
  color: 'white' | 'black';
  score: number;
  ts: number;
}

export interface Repertoire {
  id?: number;
  name: string;
  color: 'white' | 'black';
  /** UCI moves of the line from the starting position. */
  moves: string[];
  card: Card;
  due: number;
  addedAt: number;
}

export interface LessonProgress {
  lessonId: string;
  stars: number;
  completedAt: number;
}

export const db = new Dexie('chess-trainer') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  reviews: EntityTable<ReviewCard, 'puzzleId'>;
  rushRuns: EntityTable<RushRun, 'id'>;
  games: EntityTable<SavedGame, 'id'>;
  drillResults: EntityTable<DrillResult, 'drillId'>;
  visionRuns: EntityTable<VisionRun, 'id'>;
  repertoire: EntityTable<Repertoire, 'id'>;
  lessons: EntityTable<LessonProgress, 'lessonId'>;
};

db.version(1).stores({
  profile: 'id',
  attempts: '++id, puzzleId, ts, mode',
  reviews: 'puzzleId, due',
  rushRuns: '++id, mode, ts, score',
});
db.version(2).stores({
  games: '++id, ts, source, externalId',
  drillResults: 'drillId',
  visionRuns: '++id, mode, ts',
  repertoire: '++id, due',
  lessons: 'lessonId',
});

import { negate, winPercent, type Score } from './uci';

export type MoveClass = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const CLASS_INFO: Record<MoveClass, { label: string; icon: string; color: string }> = {
  book: { label: 'Khai cuộc', icon: '📖', color: '#a88865' },
  best: { label: 'Tốt nhất', icon: '★', color: '#81b64c' },
  excellent: { label: 'Rất tốt', icon: '👍', color: '#96bc4b' },
  good: { label: 'Tốt', icon: '✓', color: '#95b776' },
  inaccuracy: { label: 'Thiếu chính xác', icon: '?!', color: '#f7c631' },
  mistake: { label: 'Sai lầm', icon: '?', color: '#e58f2a' },
  blunder: { label: 'Sai nghiêm trọng', icon: '??', color: '#ca3431' },
};

/** Evaluation of a position from the side to move, or the result if the game is over. */
export interface PositionEval {
  score: Score;
  best: string | null;
}

export interface MoveReview {
  ply: number;
  /** Winning chances of the side that moved, before and after the move (0–100). */
  winBefore: number;
  winAfter: number;
  cls: MoveClass;
  accuracy: number;
  bestMove: string | null;
}

/** Lichess' per-move accuracy from the drop in winning chances. */
export function moveAccuracy(winDrop: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, winDrop)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export function classify(winDrop: number, isBest: boolean): MoveClass {
  if (isBest || winDrop <= 0.5) return 'best';
  if (winDrop <= 2) return 'excellent';
  if (winDrop <= 5) return 'good';
  if (winDrop <= 10) return 'inaccuracy';
  if (winDrop <= 20) return 'mistake';
  return 'blunder';
}

/**
 * Reviews each move given the engine evaluation of every position in the game
 * (positions.length === moves.length + 1). `bookPlies` moves at the start are book moves.
 */
export function reviewGame(moves: string[], positions: PositionEval[], bookPlies = 0): MoveReview[] {
  return moves.map((uci, ply) => {
    const before = positions[ply];
    const after = positions[ply + 1];
    const winBefore = winPercent(before.score);
    // `after` is from the opponent's point of view.
    const winAfter = winPercent(negate(after.score));
    const drop = Math.max(0, winBefore - winAfter);
    const cls = ply < bookPlies ? 'book' : classify(drop, uci === before.best);
    return { ply, winBefore, winAfter, cls, accuracy: moveAccuracy(drop), bestMove: before.best };
  });
}

/** Average accuracy of one side's moves (white: even plies). */
export function sideAccuracy(reviews: MoveReview[], color: 'white' | 'black'): number {
  const mine = reviews.filter((r) => (r.ply % 2 === 0) === (color === 'white'));
  if (mine.length === 0) return 0;
  return mine.reduce((s, r) => s + r.accuracy, 0) / mine.length;
}

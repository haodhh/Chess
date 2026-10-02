import { useLiveQuery } from 'dexie-react-hooks';
import { Rating } from 'ts-fsrs';
import { scheduleReview } from '../core/srs';
import { db, type LessonProgress, type Repertoire } from './db';

export async function completeLesson(lessonId: string, stars: number) {
  const prev = await db.lessons.get(lessonId);
  if (!prev || stars > prev.stars) await db.lessons.put({ lessonId, stars, completedAt: Date.now() });
}

export function useLessonProgress(): Map<string, LessonProgress> | undefined {
  return useLiveQuery(async () => new Map((await db.lessons.toArray()).map((p) => [p.lessonId, p])));
}

export async function addRepertoireLine(name: string, color: 'white' | 'black', moves: string[]): Promise<boolean> {
  const key = moves.join(' ');
  const existing = await db.repertoire.filter((r) => r.color === color && r.moves.join(' ') === key).first();
  if (existing) return false;
  const now = new Date();
  // New lines are due immediately so they can be practised right away.
  const card = scheduleReview(undefined, Rating.Again, now);
  await db.repertoire.add({ name, color, moves, card, due: now.getTime(), addedAt: now.getTime() });
  return true;
}

export function useRepertoire(): Repertoire[] | undefined {
  return useLiveQuery(() => db.repertoire.orderBy('due').toArray());
}

export async function gradeRepertoireLine(line: Repertoire, mistakes: number) {
  const card = scheduleReview(line.card, mistakes === 0 ? Rating.Good : Rating.Again);
  await db.repertoire.update(line.id!, { card, due: card.due.getTime() });
}

export async function deleteRepertoireLine(id: number) {
  await db.repertoire.delete(id);
}

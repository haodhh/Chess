import { describe, expect, it } from 'vitest';
import { mergeTables, RESET_AT, sameTables, TOMBSTONES, type Tables } from './merge';

const attempt = (id: number | undefined, ts: number, puzzleId: string) => ({ id, ts, puzzleId, success: true, themes: [] });

describe('mergeTables', () => {
  it('unions attempts from both devices, keeping local ids and dropping remote ones', () => {
    const local: Tables = { attempts: [attempt(1, 100, 'a'), attempt(2, 200, 'b')] };
    const remote: Tables = { attempts: [attempt(1, 100, 'a'), attempt(1, 150, 'c')] };
    const m = mergeTables(local, remote);
    expect(m.attempts).toHaveLength(3);
    expect(m.attempts!.find((r) => r.puzzleId === 'a')!.id).toBe(1);
    expect(m.attempts!.find((r) => r.puzzleId === 'c')!.id).toBeUndefined();
  });

  it('keeps the newer profile and review card', () => {
    const local: Tables = {
      profile: [{ id: 'me' as never, rating: { rating: 1500 }, ratedAt: 10, updatedAt: 10 }],
      reviews: [{ puzzleId: 'x', addedAt: 1, card: { last_review: new Date(5) } }],
    };
    const remote: Tables = {
      profile: [{ id: 'me' as never, rating: { rating: 1600 }, ratedAt: 20, updatedAt: 20 }],
      reviews: [{ puzzleId: 'x', addedAt: 1, card: { last_review: new Date(3).toISOString() } }],
    };
    const m = mergeTables(local, remote);
    expect((m.profile![0].rating as { rating: number }).rating).toBe(1600);
    expect(m.reviews![0].card).toEqual({ last_review: new Date(5) });
  });

  it('keeps the best drill and lesson results and the analysed game', () => {
    const m = mergeTables(
      {
        drillResults: [{ drillId: 'd', stars: 2, bestMoves: 10, ts: 5 }],
        lessons: [{ lessonId: 'l', stars: 3, completedAt: 1 }],
        games: [{ id: 4, ts: 9, source: 'bot', pgn: '1. e4' }],
      },
      {
        drillResults: [{ drillId: 'd', stars: 3, bestMoves: 20, ts: 1 }],
        lessons: [{ lessonId: 'l', stars: 1, completedAt: 9 }],
        games: [{ id: 7, ts: 9, source: 'bot', pgn: '1. e4', analysis: { depth: 12 } }],
      },
    );
    expect(m.drillResults![0].stars).toBe(3);
    expect(m.lessons![0].stars).toBe(3);
    expect(m.games![0]).toMatchObject({ id: 4, analysis: { depth: 12 } });
  });

  it('does not bring back deleted records, but allows re-adding later', () => {
    const local: Tables = {
      reviews: [{ puzzleId: 'new', addedAt: 50, card: {} }],
      kv: [{ key: TOMBSTONES, value: { 'reviews|old': 30, 'reviews|new': 40 }, updatedAt: 40 }],
    };
    const remote: Tables = { reviews: [{ puzzleId: 'old', addedAt: 10, card: {} }] };
    const m = mergeTables(local, remote);
    expect(m.reviews!.map((r) => r.puzzleId)).toEqual(['new']);
    expect(m.kv!.find((r) => r.key === TOMBSTONES)!.value).toEqual({ 'reviews|old': 30, 'reviews|new': 40 });
  });

  it('drops everything older than a reset on either device', () => {
    const remote: Tables = { attempts: [attempt(1, 100, 'a')], lessons: [{ lessonId: 'l', stars: 3, completedAt: 100 }] };
    const local: Tables = { attempts: [attempt(1, 300, 'b')], kv: [{ key: RESET_AT, value: 200, updatedAt: 200 }] };
    const m = mergeTables(local, remote);
    expect(m.attempts!.map((r) => r.puzzleId)).toEqual(['b']);
    expect(m.lessons).toEqual([]);
  });

  it('keeps the newer kv value, including a cleared game', () => {
    const m = mergeTables(
      { kv: [{ key: 'ongoingBotGame', value: null, updatedAt: 20 }] },
      { kv: [{ key: 'ongoingBotGame', value: { moves: ['e2e4'] }, updatedAt: 10 }] },
    );
    expect(m.kv).toEqual([{ key: 'ongoingBotGame', value: null, updatedAt: 20 }]);
  });
});

describe('sameTables', () => {
  it('ignores row order, key order, local ids and Date vs ISO string', () => {
    const a: Tables = { attempts: [attempt(1, 1, 'a'), attempt(2, 2, 'b')], reviews: [{ puzzleId: 'x', card: { due: new Date(0) } }] };
    const b: Tables = { attempts: [attempt(undefined, 2, 'b'), attempt(9, 1, 'a')], reviews: [{ card: { due: new Date(0).toISOString() }, puzzleId: 'x' }] };
    expect(sameTables(a, b)).toBe(true);
    expect(sameTables(a, { attempts: [attempt(1, 1, 'a')] })).toBe(false);
  });
});

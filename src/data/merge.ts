// Merging two copies of the app's data (this device and the online copy) without
// losing progress made on either side. Pure functions, so they can be unit tested.

export const SYNC_TABLES = [
  'profile',
  'attempts',
  'reviews',
  'rushRuns',
  'games',
  'drillResults',
  'visionRuns',
  'repertoire',
  'lessons',
  'kv',
] as const;

export type TableName = (typeof SYNC_TABLES)[number];
export type Row = Record<string, unknown> & { id?: number };
export type Tables = Partial<Record<TableName, Row[]>>;

/** kv keys with special meaning for merging. */
export const TOMBSTONES = 'tombstones';
export const RESET_AT = 'resetAt';

const num = (v: unknown): number =>
  typeof v === 'number'
    ? v
    : v instanceof Date
      ? v.getTime()
      : typeof v === 'string'
        ? new Date(v).getTime() || 0
        : 0;
const cardTime = (row: Row) => {
  const card = row.card as { last_review?: unknown } | undefined;
  return Math.max(num(card?.last_review), num(row.addedAt));
};

interface TableSpec {
  /** Identifies the same record on both sides. */
  key: (row: Row) => string;
  /** When the record was last changed. */
  stamp: (row: Row) => number;
  /** Chooses between two versions of a record; defaults to the newer one. */
  pick?: (a: Row, b: Row) => Row;
  /** Tables whose primary key is an auto-incremented id that differs between devices. */
  autoId?: boolean;
}

const newer = (spec: TableSpec) => (a: Row, b: Row) => (spec.stamp(b) > spec.stamp(a) ? b : a);

export const SPECS: Record<TableName, TableSpec> = {
  profile: { key: () => 'me', stamp: (r) => Math.max(num(r.updatedAt), num(r.ratedAt)) },
  attempts: { key: (r) => `${r.ts}|${r.puzzleId}`, stamp: (r) => num(r.ts), autoId: true },
  reviews: { key: (r) => String(r.puzzleId), stamp: cardTime },
  rushRuns: { key: (r) => `${r.ts}|${r.mode}`, stamp: (r) => num(r.ts), autoId: true },
  games: {
    key: (r) => `${r.ts}|${r.source}`,
    stamp: (r) => num(r.ts),
    // Keep the analysed copy so Stockfish does not have to run again.
    pick: (a, b) => (!a.analysis && b.analysis ? b : a),
    autoId: true,
  },
  drillResults: {
    key: (r) => String(r.drillId),
    stamp: (r) => num(r.ts),
    pick: (a, b) =>
      num(b.stars) > num(a.stars) || (num(b.stars) === num(a.stars) && num(b.bestMoves) < num(a.bestMoves)) ? b : a,
  },
  visionRuns: { key: (r) => `${r.ts}|${r.mode}|${r.color}`, stamp: (r) => num(r.ts), autoId: true },
  repertoire: { key: (r) => `${r.color}|${(r.moves as string[]).join(' ')}`, stamp: cardTime, autoId: true },
  lessons: {
    key: (r) => String(r.lessonId),
    stamp: (r) => num(r.completedAt),
    pick: (a, b) => (num(b.stars) > num(a.stars) ? b : a),
  },
  kv: { key: (r) => String(r.key), stamp: (r) => num(r.updatedAt) },
};

export const naturalKey = (table: TableName, row: Row) => `${table}|${SPECS[table].key(row)}`;

function kvValue(tables: Tables, key: string): unknown {
  return tables.kv?.find((r) => r.key === key)?.value;
}

/**
 * Merges the online copy into the local one. Records are matched by natural key and
 * the newer (or better) version wins; deleted records stay deleted (tombstones) and a
 * "reset all data" on either device drops everything older than the reset.
 * Local auto-increment ids are kept; records new to this device get fresh ids.
 */
export function mergeTables(local: Tables, remote: Tables): Tables {
  const tombstones: Record<string, number> = { ...(kvValue(remote, TOMBSTONES) as Record<string, number>) };
  for (const [k, t] of Object.entries((kvValue(local, TOMBSTONES) as Record<string, number>) ?? {})) {
    tombstones[k] = Math.max(tombstones[k] ?? 0, t);
  }
  const resetAt = Math.max(num(kvValue(local, RESET_AT)), num(kvValue(remote, RESET_AT)));

  const out: Tables = {};
  for (const table of SYNC_TABLES) {
    const spec = SPECS[table];
    const pick = spec.pick ?? newer(spec);
    const merged = new Map<string, { row: Row; localId?: number }>();
    for (const row of local[table] ?? []) merged.set(spec.key(row), { row, localId: row.id });
    for (const row of remote[table] ?? []) {
      const k = spec.key(row);
      const mine = merged.get(k);
      merged.set(k, mine ? { row: pick(mine.row, row), localId: mine.localId } : { row });
    }
    const rows: Row[] = [];
    for (const [k, { row, localId }] of merged) {
      const special = table === 'kv' && (k === TOMBSTONES || k === RESET_AT);
      if (!special) {
        if (spec.stamp(row) < resetAt) continue;
        const deletedAt = tombstones[`${table}|${k}`];
        if (deletedAt !== undefined && deletedAt >= spec.stamp(row)) continue;
      }
      if (spec.autoId) {
        const { id: _id, ...rest } = row;
        rows.push(localId !== undefined ? { ...rest, id: localId } : rest);
      } else {
        rows.push(row);
      }
    }
    out[table] = rows;
  }
  // Store the combined tombstones and reset time so other devices learn about them.
  const kv = (out.kv ?? []).filter((r) => r.key !== TOMBSTONES && r.key !== RESET_AT);
  const now = Math.max(0, ...Object.values(tombstones));
  if (Object.keys(tombstones).length) kv.push({ key: TOMBSTONES, value: tombstones, updatedAt: now });
  if (resetAt) kv.push({ key: RESET_AT, value: resetAt, updatedAt: resetAt });
  out.kv = kv;
  return out;
}

/** JSON with sorted object keys, so equal data always serialises the same way. */
function stable(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Order-insensitive comparison (ignoring local ids) used to skip writes when nothing changed. */
export function sameTables(a: Tables, b: Tables): boolean {
  for (const table of SYNC_TABLES) {
    const spec = SPECS[table];
    const norm = (rows: Row[] = []) =>
      rows
        .map((r) => {
          const { id: _id, ...rest } = r;
          return stable(spec.autoId ? rest : r);
        })
        .sort()
        .join('\n');
    if (norm(a[table]) !== norm(b[table])) return false;
  }
  return true;
}

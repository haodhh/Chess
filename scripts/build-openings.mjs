#!/usr/bin/env node
// Builds public/data/openings.json from the Lichess opening names dataset (CC0):
// https://github.com/lichess-org/chess-openings
//
// Usage: node scripts/build-openings.mjs [dir-with-a..e.tsv]
// Without a directory the TSV files are downloaded from GitHub.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Chess } from 'chess.js';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

/** FEN without the move counters, as used for transposition lookups. */
export const epdOf = (fen) => fen.split(' ').slice(0, 4).join(' ');

export function parseTsv(text) {
  const rows = [];
  for (const line of text.split('\n').slice(1)) {
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;
    const chess = new Chess();
    chess.loadPgn(pgn);
    const uci = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    rows.push([eco, name, uci.join(' '), epdOf(chess.fen())]);
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const rows = [];
  for (const f of ['a', 'b', 'c', 'd', 'e']) {
    const text = dir
      ? await readFile(path.join(dir, `${f}.tsv`), 'utf8')
      : await (await fetch(`${BASE}${f}.tsv`)).text();
    rows.push(...parseTsv(text));
  }
  await mkdir('public/data', { recursive: true });
  await writeFile(
    'public/data/openings.json',
    JSON.stringify({ source: 'https://github.com/lichess-org/chess-openings (CC0)', openings: rows }),
  );
  console.log(`Wrote ${rows.length} openings`);
}

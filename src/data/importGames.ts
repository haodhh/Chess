import { Chess } from 'chess.js';
import type { SavedGame } from './db';
import { knownExternalIds, saveGame } from './train';

type NewGame = Omit<SavedGame, 'id'>;

/** Parses a single-game PGN and reads the players and result from its headers. */
export function gameFromPgn(pgn: string, userColor: 'white' | 'black', source: SavedGame['source'] = 'pgn'): NewGame {
  const c = new Chess();
  c.loadPgn(pgn.trim());
  if (c.history().length === 0) throw new Error('PGN không có nước đi nào.');
  const h = c.getHeaders();
  return {
    ts: Date.now(),
    source,
    pgn: c.pgn(),
    white: h.White && h.White !== '?' ? h.White : 'Trắng',
    black: h.Black && h.Black !== '?' ? h.Black : 'Đen',
    result: h.Result && h.Result !== '*' ? h.Result : '*',
    userColor,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) throw new Error('Không tìm thấy người chơi này.');
  if (!res.ok) throw new Error(`Lỗi ${res.status} khi tải dữ liệu.`);
  return res.json() as Promise<T>;
}

interface ChessComGame {
  url: string;
  uuid?: string;
  pgn?: string;
  rules: string;
  end_time: number;
  white: { username: string };
  black: { username: string };
}

/** Imports the user's most recent chess.com games; returns how many were new. */
export async function importChessCom(username: string, max = 20): Promise<number> {
  const name = username.trim().toLowerCase();
  const { archives } = await getJson<{ archives: string[] }>(
    `https://api.chess.com/pub/player/${encodeURIComponent(name)}/games/archives`,
  );
  const known = await knownExternalIds();
  const found: NewGame[] = [];
  for (const archive of [...archives].reverse().slice(0, 6)) {
    const { games } = await getJson<{ games: ChessComGame[] }>(archive);
    for (const g of games.sort((a, b) => b.end_time - a.end_time)) {
      const externalId = `chesscom:${g.uuid ?? g.url}`;
      if (g.rules !== 'chess' || !g.pgn || known.has(externalId)) continue;
      try {
        const color = g.white.username.toLowerCase() === name ? 'white' : 'black';
        found.push({ ...gameFromPgn(g.pgn, color, 'chesscom'), ts: g.end_time * 1000, externalId });
      } catch {
        // Skip games chess.js cannot read.
      }
      if (found.length >= max) break;
    }
    if (found.length >= max) break;
  }
  for (const g of found) await saveGame(g);
  return found.length;
}

interface LichessGame {
  id: string;
  variant: string;
  createdAt: number;
  pgn?: string;
  players: { white: { user?: { name: string } }; black: { user?: { name: string } } };
}

/** Imports the user's most recent standard Lichess games; returns how many were new. */
export async function importLichess(username: string, max = 20): Promise<number> {
  const name = username.trim();
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(name)}?max=${max}&pgnInJson=true&clocks=false&evals=false`,
    { headers: { Accept: 'application/x-ndjson' } },
  );
  if (res.status === 404) throw new Error('Không tìm thấy người chơi này.');
  if (!res.ok) throw new Error(`Lỗi ${res.status} khi tải dữ liệu.`);
  const known = await knownExternalIds();
  let added = 0;
  for (const line of (await res.text()).split('\n')) {
    if (!line.trim()) continue;
    const g = JSON.parse(line) as LichessGame;
    const externalId = `lichess:${g.id}`;
    if (g.variant !== 'standard' || !g.pgn || known.has(externalId)) continue;
    try {
      const color = g.players.white.user?.name.toLowerCase() === name.toLowerCase() ? 'white' : 'black';
      await saveGame({ ...gameFromPgn(g.pgn, color, 'lichess'), ts: g.createdAt, externalId });
      added++;
    } catch {
      // Skip unreadable games.
    }
  }
  return added;
}

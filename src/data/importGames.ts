import { Chess } from 'chess.js';
import type { SavedGame } from './db';

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

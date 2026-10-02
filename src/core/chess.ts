import { Chess, type Square } from 'chess.js';
import type { Color, Key } from '@lichess-org/chessground/types';

export type Promotion = 'q' | 'r' | 'b' | 'n';

export const colorOf = (turn: 'w' | 'b'): Color => (turn === 'w' ? 'white' : 'black');
export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white');

export function parseUci(uci: string): { from: Square; to: Square; promotion?: Promotion } {
  const promotion = uci[4] as Promotion | undefined;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, ...(promotion ? { promotion } : {}) };
}

export const toUci = (from: string, to: string, promotion?: string) => `${from}${to}${promotion ?? ''}`;

/** Legal destinations for chessground, keyed by origin square. */
export function legalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from);
    if (list) list.push(m.to);
    else dests.set(m.from, [m.to]);
  }
  return dests;
}

export function isPromotionMove(chess: Chess, from: string, to: string): boolean {
  const piece = chess.get(from as Square);
  return piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
}

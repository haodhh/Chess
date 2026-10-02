import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { Color } from '@lichess-org/chessground/types';
import { colorOf, parseUci } from '../core/chess';
import { playSound } from '../core/sound';
import { pickWeakMove, type BotLevel } from './bot';
import { getEngine, isCancelled } from './engine';

export interface GameOver {
  winner: Color | null;
  reason: string;
}

export function gameOverOf(chess: Chess): GameOver | null {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'black' : 'white', reason: 'Chiếu hết' };
  if (chess.isStalemate()) return { winner: null, reason: 'Hết nước đi (hòa)' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Không đủ quân chiếu hết (hòa)' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Lặp lại thế cờ 3 lần (hòa)' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'Luật 50 nước (hòa)' };
  return null;
}

/** Chooses the bot's move in `fen` for the given level. */
export async function botMove(fen: string, level: BotLevel): Promise<string | null> {
  const engine = getEngine();
  if (level.weak) {
    const r = await engine.analyse(fen, { depth: level.weak.depth, multiPv: level.weak.multiPv });
    return pickWeakMove(r.lines, level.weak) ?? r.bestMove;
  }
  const r = await engine.analyse(fen, {
    movetime: level.movetime ?? 800,
    elo: level.id === 'max' ? undefined : level.elo,
  });
  return r.bestMove;
}

export interface EngineGameOptions {
  startFen?: string;
  userColor: Color;
  level: BotLevel;
  /** Minimum time the bot appears to think, in ms. */
  minThinkMs?: number;
  /** Stops the bot from replying, e.g. once a drill is decided. */
  paused?: boolean;
  /** UCI moves already played, to resume a saved game. */
  initialMoves?: string[];
}

/** A game between the user and a Stockfish bot. */
export function useEngineGame({ startFen, userColor, level, minThinkMs = 500, paused, initialMoves }: EngineGameOptions) {
  const [chess] = useState(() => {
    const c = new Chess(startFen);
    for (const m of initialMoves ?? []) c.move(parseUci(m));
    return c;
  });
  const [moves, setMoves] = useState<Move[]>(() => chess.history({ verbose: true }));
  const [over, setOver] = useState<GameOver | null>(() => gameOverOf(chess));
  const [thinking, setThinking] = useState(false);
  const generation = useRef(0);

  const sync = useCallback(() => {
    setMoves(chess.history({ verbose: true }));
    setOver(gameOverOf(chess));
  }, [chess]);

  const apply = useCallback(
    (uci: string) => {
      const m = chess.move(parseUci(uci));
      playSound(m.captured ? 'capture' : 'move');
      sync();
      return m;
    },
    [chess, sync],
  );

  // The bot replies whenever it is its turn.
  const turn = colorOf(chess.turn());
  useEffect(() => {
    if (over || paused || turn === userColor) return;
    const gen = ++generation.current;
    setThinking(true);
    const started = Date.now();
    botMove(chess.fen(), level)
      .then(async (uci) => {
        const wait = minThinkMs - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (gen === generation.current && uci) apply(uci);
      })
      .catch((e) => {
        if (!isCancelled(e)) console.error(e);
      });
    return () => {
      // A newer position or unmount makes this search's result stale.
      generation.current++;
      setThinking(false);
    };
    // `moves` changes on every move, so the effect runs after each user move.
  }, [moves, over, paused, turn, userColor, level, chess, apply, minThinkMs]);

  const userMove = (uci: string): boolean => {
    if (over || paused || turn !== userColor) return false;
    try {
      apply(uci);
      return true;
    } catch {
      return false;
    }
  };

  /** Takes back the last move pair so it is the user's turn again. */
  const takeback = () => {
    generation.current++;
    getEngine().cancelAll();
    chess.undo();
    if (colorOf(chess.turn()) !== userColor) chess.undo();
    sync();
  };

  const resign = () => {
    generation.current++;
    getEngine().cancelAll();
    setOver({ winner: userColor === 'white' ? 'black' : 'white', reason: 'Bạn đã xin thua' });
  };

  return { chess, moves, over, thinking, turn, userMove, takeback, resign };
}

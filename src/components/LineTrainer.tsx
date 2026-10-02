import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci } from '../core/chess';
import { LineSession } from '../core/line';
import { playSound } from '../core/sound';
import type { Settings } from '../data/db';
import { Board } from './Board';

export type LineStatus = 'play' | 'wrong' | 'correct' | 'done';

/**
 * Board for practising a scripted line: the user plays their moves, the other side's
 * replies are automatic. After two mistakes the expected move is shown with an arrow.
 */
export function LineTrainer({
  fen,
  line,
  userTurn,
  orientation,
  settings,
  onStatus,
  onDone,
  revealAfter = 2,
}: {
  fen: string;
  line: string[];
  userTurn?: 'w' | 'b';
  orientation?: Color;
  settings: Settings;
  onStatus?: (s: LineStatus, mistakes: number) => void;
  onDone?: (mistakes: number) => void;
  revealAfter?: number;
}) {
  const session = useMemo(() => new LineSession(fen, line, userTurn), [fen, line, userTurn]);
  const [, setTick] = useState(0);
  const [syncKey, setSyncKey] = useState(0);
  const [wrongInRow, setWrongInRow] = useState(0);
  const callbacks = useRef({ onStatus, onDone });
  callbacks.current = { onStatus, onDone };

  // Play the other side's moves automatically.
  const advance = () => {
    const t = window.setTimeout(() => {
      const m = session.playOpponent();
      if (m) {
        playSound(m.captured ? 'capture' : 'move');
        setTick((x) => x + 1);
        if (session.isDone) {
          callbacks.current.onStatus?.('done', session.mistakes);
          callbacks.current.onDone?.(session.mistakes);
        } else advance();
      }
    }, 450);
    return t;
  };
  useEffect(() => {
    const t = advance();
    return () => clearTimeout(t);
    // Only on a new line.
  }, [session]);

  const chess = new Chess(session.chess.fen());
  const canMove = session.isUserTurn;
  const dests = useMemo(() => (canMove ? legalDests(chess) : new Map()), [session.chess.fen(), canMove]);
  const last = session.lastMove;
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);
  const shapes = useMemo<DrawShape[]>(() => {
    if (wrongInRow < revealAfter || !session.expected) return [];
    const { from, to } = parseUci(session.expected);
    return [{ orig: from, dest: to, brush: 'green' }];
  }, [wrongInRow, revealAfter, session, session.ply]);

  const onMove = (o: Key, d: Key, p?: 'q' | 'r' | 'b' | 'n') => {
    const verdict = session.tryMove(toUci(o, d, p));
    if (verdict === 'wrong') {
      playSound('error');
      setSyncKey((k) => k + 1);
      setWrongInRow((w) => w + 1);
      callbacks.current.onStatus?.('wrong', session.mistakes);
      return;
    }
    setWrongInRow(0);
    const m = session.lastMove!;
    playSound(m.captured ? 'capture' : 'move');
    setTick((x) => x + 1);
    if (verdict === 'done') {
      playSound('success');
      callbacks.current.onStatus?.('done', session.mistakes);
      callbacks.current.onDone?.(session.mistakes);
    } else {
      callbacks.current.onStatus?.('correct', session.mistakes);
      advance();
    }
  };

  return (
    <Board
      fen={session.chess.fen()}
      orientation={orientation ?? (session.userTurn === 'w' ? 'white' : 'black')}
      turnColor={colorOf(chess.turn())}
      movable={canMove ? colorOf(session.userTurn) : undefined}
      dests={dests}
      lastMove={lastMove}
      check={chess.inCheck()}
      shapes={shapes}
      coordinates={settings.coordinates}
      animation={settings.animation}
      theme={settings.boardTheme}
      syncKey={syncKey}
      isPromotion={(o, d) => isPromotionMove(chess, o, d)}
      onMove={onMove}
    />
  );
}

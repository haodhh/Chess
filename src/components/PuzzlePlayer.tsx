import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci, type Promotion } from '../core/chess';
import { PuzzleSession, type Puzzle } from '../core/puzzle';
import { playSound } from '../core/sound';
import { themeName } from '../core/themes';
import type { Settings } from '../data/db';
import { Board } from './Board';

export interface PuzzleOutcome {
  success: boolean;
  usedHint: boolean;
  timeMs: number;
}

type Status = 'setup' | 'play' | 'wrong' | 'correct' | 'solved' | 'revealing' | 'failed';

interface Props {
  puzzle: Puzzle;
  settings: Settings;
  /** Rush mode: a wrong move ends the puzzle at once, and there are no hints or solutions. */
  rush?: boolean;
  /** Called exactly once per puzzle: at the first mistake, when the solution is shown, or when solved. */
  onResult: (outcome: PuzzleOutcome) => void;
  /** Called when the puzzle is over (solved, failed in rush mode, or solution fully shown). */
  onFinished?: (success: boolean) => void;
  onNext?: () => void;
  nextLabel?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

interface LinePosition {
  fen: string;
  move?: Move;
}

export function PuzzlePlayer({ puzzle, settings, rush, onResult, onFinished, onNext, nextLabel, header, footer }: Props) {
  const session = useMemo(() => new PuzzleSession(puzzle), [puzzle]);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const [status, setStatus] = useState<Status>('setup');
  const [syncKey, setSyncKey] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [viewPly, setViewPly] = useState<number | null>(null);

  const timers = useRef<number[]>([]);
  const reported = useRef(false);
  const hadMistake = useRef(false);
  const usedHint = useRef(false);
  const startedAt = useRef(0);
  const callbacks = useRef({ onResult, onFinished });
  callbacks.current = { onResult, onFinished };

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const report = useCallback((success: boolean) => {
    if (reported.current) return;
    reported.current = true;
    callbacks.current.onResult({ success, usedHint: usedHint.current, timeMs: Date.now() - startedAt.current });
  }, []);

  const moveSound = (m: Move) => playSound(m.captured ? 'capture' : 'move');

  // Start each puzzle by playing the opponent's setup move.
  useEffect(() => {
    reported.current = false;
    hadMistake.current = false;
    usedHint.current = false;
    setStatus('setup');
    setHintLevel(0);
    setViewPly(null);
    later(rush ? 250 : 600, () => {
      moveSound(session.playScripted());
      startedAt.current = Date.now();
      setStatus('play');
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [session, rush, later]);

  const handleMove = (orig: Key, dest: Key, promotion?: Promotion) => {
    const verdict = session.tryMove(toUci(orig, dest, promotion));
    setHintLevel(0);
    if (verdict === 'wrong') {
      playSound('error');
      hadMistake.current = true;
      report(false);
      setSyncKey((k) => k + 1);
      if (rush) {
        setStatus('failed');
        later(500, () => callbacks.current.onFinished?.(false));
      } else {
        setStatus('wrong');
      }
      return;
    }
    if (session.lastMove) moveSound(session.lastMove);
    if (verdict === 'solved') {
      const success = !hadMistake.current && !usedHint.current;
      playSound('success');
      report(success);
      setStatus('solved');
      later(rush ? 300 : 0, () => callbacks.current.onFinished?.(success));
      rerender();
      return;
    }
    setStatus('correct');
    rerender();
    later(rush ? 250 : 450, () => {
      moveSound(session.playScripted());
      setStatus('play');
    });
  };

  const showHint = () => {
    usedHint.current = true;
    setHintLevel((h) => Math.min(2, h + 1));
  };

  const showSolution = () => {
    report(false);
    setHintLevel(0);
    setStatus('revealing');
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const step = () => {
      if (session.isComplete) {
        setStatus('failed');
        callbacks.current.onFinished?.(false);
        return;
      }
      moveSound(session.playScripted());
      rerender();
      later(650, step);
    };
    later(150, step);
  };

  const finished = status === 'solved' || status === 'failed';
  const line = useMemo(() => buildLine(puzzle), [puzzle]);

  // Board state: the live session, or a position from the move list once the puzzle is over.
  const viewing = finished && viewPly !== null ? line[viewPly] : null;
  const fen = viewing ? viewing.fen : session.fen;
  const last = viewing ? viewing.move : session.lastMove;
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const canMove = (status === 'play' || status === 'wrong') && session.isSolverTurn && !viewing;
  const dests = useMemo(() => (canMove ? legalDests(chess) : new Map()), [chess, canMove]);

  const shapes = useMemo<DrawShape[]>(() => {
    const expected = session.expectedMove;
    if (!expected || hintLevel === 0) return [];
    const { from, to } = parseUci(expected);
    return hintLevel === 1 ? [{ orig: from, brush: 'green' }] : [{ orig: from, dest: to, brush: 'green' }];
  }, [hintLevel, session, status]);

  useEffect(() => {
    if (!finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setViewPly((p) => Math.max(0, (p ?? line.length - 1) - 1));
      if (e.key === 'ArrowRight') setViewPly((p) => Math.min(line.length - 1, (p ?? line.length - 1) + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, line.length]);

  const solver = session.solverColor === 'white' ? 'Trắng' : 'Đen';
  const success = status === 'solved' && !hadMistake.current && !usedHint.current;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" data-puzzle-id={puzzle.id}>
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-150px))]">
        <Board
          fen={fen}
          orientation={session.solverColor}
          turnColor={colorOf(chess.turn())}
          movable={canMove ? session.solverColor : undefined}
          dests={dests}
          lastMove={lastMove}
          check={chess.inCheck()}
          shapes={shapes}
          coordinates={settings.coordinates}
          animation={settings.animation}
          theme={settings.boardTheme}
          syncKey={syncKey}
          isPromotion={(o, d) => isPromotionMove(chess, o, d)}
          onMove={handleMove}
        />
      </div>

      <aside className="flex flex-col gap-3">
        {header}
        <StatusCard status={status} solver={solver} success={success} rush={rush} />

        {!rush && !finished && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={showHint} disabled={!canMove || hintLevel >= 2}>
              💡 Gợi ý
            </button>
            <button className="btn" onClick={showSolution} disabled={status === 'setup' || status === 'revealing'}>
              👁 Xem lời giải
            </button>
          </div>
        )}

        {finished && !rush && (
          <>
            {onNext && (
              <button className="btn btn-primary text-lg" onClick={onNext} autoFocus>
                {nextLabel ?? 'Puzzle tiếp theo →'}
              </button>
            )}
            <MoveList line={line} current={viewPly ?? line.length - 1} onSelect={setViewPly} />
            <PuzzleMeta puzzle={puzzle} fen={fen} />
          </>
        )}
        {footer}
      </aside>
    </div>
  );
}

function buildLine(puzzle: Puzzle): LinePosition[] {
  const chess = new Chess(puzzle.fen);
  const line: LinePosition[] = [];
  for (const uci of puzzle.moves) {
    const move = chess.move(parseUci(uci));
    line.push({ fen: chess.fen(), move });
  }
  return line;
}

function StatusCard({ status, solver, success, rush }: { status: Status; solver: string; success: boolean; rush?: boolean }) {
  const content: Record<Status, { icon: string; title: string; text?: string; tone: string }> = {
    setup: { icon: '⏳', title: 'Đối thủ đang đi…', tone: 'bg-panel' },
    play: { icon: '♟', title: `Bạn cầm quân ${solver}`, text: 'Tìm nước đi tốt nhất.', tone: 'bg-panel' },
    correct: { icon: '✓', title: 'Chính xác!', text: 'Tiếp tục…', tone: 'bg-good/20 border-good' },
    wrong: { icon: '✗', title: 'Chưa đúng', text: 'Thử nước khác nhé.', tone: 'bg-bad/20 border-bad' },
    revealing: { icon: '👁', title: 'Đang hiện lời giải…', tone: 'bg-panel' },
    solved: success
      ? { icon: '🎉', title: 'Giải đúng!', tone: 'bg-good/20 border-good' }
      : { icon: '✓', title: 'Đã giải xong', text: 'Không tính là đúng vì đã đi sai hoặc dùng gợi ý.', tone: 'bg-panel' },
    failed: rush
      ? { icon: '✗', title: 'Sai rồi!', tone: 'bg-bad/20 border-bad' }
      : { icon: '📘', title: 'Lời giải', text: 'Bài này đã được thêm vào mục Ôn lỗi.', tone: 'bg-panel' },
  };
  const c = content[status];
  return (
    <div className={`rounded-xl border border-transparent p-4 ${c.tone}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{c.icon}</span>
        <div>
          <div className="text-lg font-semibold">{c.title}</div>
          {c.text && <div className="text-sm text-muted">{c.text}</div>}
        </div>
      </div>
    </div>
  );
}

function MoveList({ line, current, onSelect }: { line: LinePosition[]; current: number; onSelect: (i: number) => void }) {
  return (
    <div className="rounded-xl bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Diễn biến</span>
        <span className="flex gap-1">
          <button className="btn btn-sm" onClick={() => onSelect(Math.max(0, current - 1))} aria-label="Nước trước">
            ◀
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onSelect(Math.min(line.length - 1, current + 1))}
            aria-label="Nước sau"
          >
            ▶
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 font-mono text-sm">
        {line.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`rounded px-1.5 py-0.5 ${i === current ? 'bg-accent text-black' : 'hover:bg-white/10'} ${i === 0 ? 'opacity-60' : ''}`}
            title={i === 0 ? 'Nước của đối thủ trước khi bắt đầu' : undefined}
          >
            {p.move?.san}
          </button>
        ))}
      </div>
    </div>
  );
}

function PuzzleMeta({ puzzle, fen }: { puzzle: Puzzle; fen: string }) {
  return (
    <div className="rounded-xl bg-panel p-3 text-sm">
      <div className="mb-2 flex justify-between">
        <span className="text-muted">Puzzle #{puzzle.id}</span>
        <span>
          Độ khó <b>{puzzle.rating}</b>
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {puzzle.themes.map((t) => (
          <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {themeName(t)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link className="link" to={`/train/analysis?fen=${encodeURIComponent(fen)}`}>
          🔍 Phân tích thế cờ này
        </Link>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { EvalBar } from '../../components/EvalBar';
import { MoveTable } from '../../components/MoveTable';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { getEngine, isCancelled } from '../../engine/engine';
import { formatScore, negate, type PvLine, type Score } from '../../engine/uci';
import { useProfile } from '../../data/store';

const START = new Chess().fen();

/** Converts a PV of UCI moves to SAN, stopping at the first illegal move. */
export function pvToSan(fen: string, pv: string[], max = 10): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(c.move(parseUci(uci)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** White-relative score of a line evaluated with `turn` to move. */
export const whiteScore = (s: Score, turn: Color): Score => (turn === 'white' ? s : negate(s));

export function Analysis() {
  const profile = useProfile();
  const [params] = useSearchParams();
  const [startFen, setStartFen] = useState(() => params.get('fen') ?? START);
  const [moves, setMoves] = useState<Move[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [orientation, setOrientation] = useState<Color>(() => (new Chess(params.get('fen') ?? START).turn() === 'w' ? 'white' : 'black'));
  const [engineOn, setEngineOn] = useState(true);
  const [lines, setLines] = useState<PvLine[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const gen = useRef(0);

  const chess = useMemo(() => {
    const c = new Chess(startFen);
    for (const m of moves.slice(0, cursor + 1)) c.move(m.san);
    return c;
  }, [startFen, moves, cursor]);
  const fen = chess.fen();
  const turn = colorOf(chess.turn());

  useEffect(() => {
    setLines([]);
    if (!engineOn || chess.isGameOver()) return;
    const g = ++gen.current;
    getEngine()
      .analyse(fen, { depth: 18, multiPv: 3, onUpdate: (ls) => g === gen.current && setLines([...ls]) }, true)
      .catch((e) => {
        if (!isCancelled(e)) console.error(e);
      });
    return () => {
      gen.current++;
    };
  }, [fen, engineOn, chess]);

  useEffect(() => () => getEngine().cancelAll(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(-1, c - 1));
      if (e.key === 'ArrowRight') setCursor((c) => Math.min(moves.length - 1, c + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const play = (uci: string) => {
    const c = new Chess(fen);
    try {
      const m = c.move(parseUci(uci));
      playSound(m.captured ? 'capture' : 'move');
      setMoves([...moves.slice(0, cursor + 1), m]);
      setCursor(cursor + 1);
    } catch {
      setSyncKey((k) => k + 1);
    }
  };

  const load = () => {
    const text = input.trim();
    setError(null);
    const c = new Chess();
    try {
      if (text.split('/').length === 8 && !text.includes('.')) {
        c.load(text);
        setStartFen(c.fen());
        setMoves([]);
        setCursor(-1);
      } else {
        c.loadPgn(text);
        const history = c.history({ verbose: true });
        const first = history[0]?.before ?? c.fen();
        setStartFen(first);
        setMoves(history);
        setCursor(history.length - 1);
      }
      setInput('');
    } catch {
      setError('Không đọc được FEN/PGN này.');
    }
  };

  const best = lines[0];
  const shapes = useMemo<DrawShape[]>(() => {
    if (!best?.pv[0]) return [];
    const { from, to } = parseUci(best.pv[0]);
    return [{ orig: from, dest: to, brush: 'blue' }];
  }, [best]);
  const last = cursor >= 0 ? moves[cursor] : undefined;
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);
  const dests = useMemo(() => legalDests(chess), [chess]);

  if (!profile) return null;
  const evalScore: Score | null = chess.isCheckmate()
    ? { cp: turn === 'white' ? -1000 : 1000 }
    : best
      ? whiteScore(best, turn)
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-150px))] gap-2">
        {engineOn && <EvalBar score={evalScore} orientation={orientation} />}
        <div className="flex-1">
          <Board
            fen={fen}
            orientation={orientation}
            turnColor={turn}
            movable={turn}
            dests={dests}
            lastMove={lastMove}
            check={chess.inCheck()}
            shapes={engineOn ? shapes : []}
            coordinates={profile.settings.coordinates}
            animation={profile.settings.animation}
            theme={profile.settings.boardTheme}
            syncKey={syncKey}
            isPromotion={(o, d) => isPromotionMove(chess, o, d)}
            onMove={(o, d, p) => play(toUci(o, d, p))}
          />
        </div>
      </div>
      <aside className="flex flex-col gap-3">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-lg font-bold">🔍 Bàn phân tích</h1>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#81b64c]" checked={engineOn} onChange={(e) => setEngineOn(e.target.checked)} />
              Stockfish
            </label>
          </div>
          {engineOn && (
            <div className="flex flex-col gap-1 font-mono text-xs">
              {chess.isGameOver() && <div className="text-muted">Ván cờ đã kết thúc.</div>}
              {!chess.isGameOver() && lines.length === 0 && <div className="text-muted">Đang phân tích…</div>}
              {lines.map((l) => (
                <button
                  key={l.multipv}
                  className="flex gap-2 rounded px-1 py-0.5 text-left hover:bg-white/10"
                  onClick={() => l.pv[0] && play(l.pv[0])}
                  title="Bấm để đi nước này"
                >
                  <b className="w-12 shrink-0 text-white">{formatScore(whiteScore(l, turn))}</b>
                  <span className="truncate text-muted">{pvToSan(fen, l.pv, 8).join(' ')}</span>
                </button>
              ))}
              {lines[0] && <div className="text-[10px] text-muted">Độ sâu {lines[0].depth}</div>}
            </div>
          )}
        </div>
        <MoveTable
          moves={moves.map((m) => ({ san: m.san }))}
          current={cursor}
          onSelect={setCursor}
          firstPly={new Chess(startFen).turn() === 'b' ? 1 : 0}
          firstMoveNumber={Number(startFen.split(' ')[5] ?? 1)}
        />
        <div className="grid grid-cols-4 gap-2">
          <button className="btn btn-sm py-2" onClick={() => setCursor(-1)} aria-label="Về đầu">⏮</button>
          <button className="btn btn-sm py-2" onClick={() => setCursor((c) => Math.max(-1, c - 1))} aria-label="Lùi">◀</button>
          <button className="btn btn-sm py-2" onClick={() => setCursor((c) => Math.min(moves.length - 1, c + 1))} aria-label="Tiến">▶</button>
          <button className="btn btn-sm py-2" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label="Lật bàn">⇅</button>
        </div>
        <div className="card flex flex-col gap-2">
          <textarea
            className="h-20 rounded-lg bg-panel-2 p-2 font-mono text-xs"
            placeholder="Dán FEN hoặc PGN vào đây"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && <div className="text-sm text-bad">{error}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-sm py-2" onClick={load} disabled={!input.trim()}>
              Tải thế cờ
            </button>
            <button
              className="btn btn-sm py-2"
              onClick={() => {
                setStartFen(START);
                setMoves([]);
                setCursor(-1);
              }}
            >
              Bàn mới
            </button>
          </div>
          <div className="break-all font-mono text-[10px] text-muted">{fen}</div>
        </div>
      </aside>
    </div>
  );
}

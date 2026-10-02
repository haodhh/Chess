import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Chess } from 'chess.js';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { MoveTable } from '../../components/MoveTable';
import { colorOf, isPromotionMove, legalDests, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { BOT_LEVELS } from '../../engine/bot';
import { getEngine } from '../../engine/engine';
import { useEngineGame } from '../../engine/useEngineGame';
import { winPercent, negate } from '../../engine/uci';
import { DRILLS, starsFor, type Drill } from '../../data/drills';
import { useProfile } from '../../data/store';
import { saveDrillResult, useDrillResults } from '../../data/train';

const STOCKFISH = { ...BOT_LEVELS[BOT_LEVELS.length - 1], movetime: 400 };
const GOAL_LABEL = { mate: 'Chiếu hết', win: 'Thắng (phong cấp)', draw: 'Cầm hòa' };

const Stars = ({ n }: { n: number }) => (
  <span className="tracking-tight text-warn">
    {'★'.repeat(n)}
    <span className="text-white/20">{'★'.repeat(3 - n)}</span>
  </span>
);

export function Drills() {
  const results = useDrillResults();
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-extrabold">🏁 Drills: thực hành thế cờ</h1>
      <p className="mb-5 text-muted">
        Chơi tiếp các thế cờ kinh điển với Stockfish ở sức mạnh tối đa. Đạt mục tiêu càng nhanh càng được nhiều sao.
      </p>
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="mb-3 text-lg font-bold">{g}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {DRILLS.filter((d) => d.group === g).map((d) => {
              const r = results?.get(d.id);
              return (
                <Link key={d.id} to={`/train/drills/${d.id}`} className="card block transition-colors hover:bg-panel-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{d.title}</span>
                    <Stars n={r?.stars ?? 0} />
                  </div>
                  <div className="text-xs text-accent">
                    {GOAL_LABEL[d.goal]}
                    {d.goal !== 'draw' && ` · 3★: ≤ ${d.par} nước`}
                  </div>
                  <p className="mt-1 text-xs text-muted">{d.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function DrillPage() {
  const { id } = useParams();
  const drill = DRILLS.find((d) => d.id === id);
  const [attempt, setAttempt] = useState(0);
  if (!drill) return <div className="card">Không tìm thấy bài tập.</div>;
  return <DrillRun key={`${drill.id}-${attempt}`} drill={drill} onRetry={() => setAttempt((a) => a + 1)} />;
}

type Outcome = { success: boolean; text: string; stars?: number };

function DrillRun({ drill, onRetry }: { drill: Drill; onRetry: () => void }) {
  const profile = useProfile();
  const results = useDrillResults();
  const userColor: Color = new Chess(drill.fen).turn() === 'w' ? 'white' : 'black';
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const game = useEngineGame({ startFen: drill.fen, userColor, level: STOCKFISH, paused: !!outcome || checking });
  const { chess, moves, over, turn } = game;
  const checked = useRef(-1);

  const userMoves = moves.filter((m) => m.color === userColor[0]).length;

  // Decide success or failure after each move.
  useEffect(() => {
    if (outcome || checked.current === moves.length) return;
    checked.current = moves.length;
    const finish = (o: Outcome) => {
      setOutcome(o);
      playSound(o.success ? 'success' : 'error');
      if (o.success) void saveDrillResult({ drillId: drill.id, stars: o.stars ?? 1, bestMoves: userMoves, ts: Date.now() });
    };
    const win = (text: string) => {
      const stars = starsFor(drill, userMoves);
      finish({ success: true, stars, text: `${text} sau ${userMoves} nước.` });
    };

    if (over) {
      if (over.winner === userColor) return win('Chiếu hết');
      if (over.winner === null) {
        return drill.goal === 'draw'
          ? finish({ success: true, stars: 3, text: `Hòa! ${over.reason}.` })
          : finish({ success: false, text: `Ván cờ hòa (${over.reason.toLowerCase()}). Bạn đã để mất thắng lợi.` });
      }
      return finish({ success: false, text: 'Bạn đã bị chiếu hết.' });
    }

    const last = moves[moves.length - 1];
    const justMoved = last && last.color === userColor[0];
    if (!justMoved) return;

    if (drill.goal === 'win') {
      const opponent = userColor === 'white' ? 'b' : 'w';
      const pieces = chess.board().flat().filter(Boolean);
      const bare = pieces.filter((p) => p!.color === opponent).length === 1;
      const strong = pieces.some((p) => p!.color === userColor[0] && (p!.type === 'q' || p!.type === 'r'));
      if (bare && strong) return win('Bạn đã loại hết quân đối phương, phần còn lại là chiếu hết cơ bản');
      if (last.promotion) {
        setChecking(true);
        getEngine()
          .analyse(chess.fen(), { depth: 14 }, true)
          .then((r) => {
            if (winPercent(negate(r.score)) >= 85) win('Phong cấp thành công');
          })
          .finally(() => setChecking(false));
        return;
      }
    }
    if (drill.goal !== 'draw' && userMoves > drill.par * 3) {
      return finish({ success: false, text: `Đã quá ${drill.par * 3} nước mà chưa đạt mục tiêu.` });
    }
    if (drill.goal === 'draw' && userMoves >= drill.par) {
      setChecking(true);
      getEngine()
        .analyse(chess.fen(), { depth: 16 }, true)
        .then((r) => {
          const mine = winPercent(negate(r.score));
          finish(
            mine >= 35
              ? { success: true, stars: 3, text: `Bạn đã cầm cự ${userMoves} nước, thế cờ vẫn hòa. Xuất sắc!` }
              : { success: false, text: 'Đối phương đã giành được thế thắng. Thử lại nhé!' },
          );
        })
        .finally(() => setChecking(false));
    }
  }, [moves, over, outcome, chess, drill, userColor, userMoves]);

  const fen = chess.fen();
  const last = moves[moves.length - 1];
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);
  const canMove = !outcome && !checking && !over && turn === userColor;
  const dests = useMemo(() => (canMove ? legalDests(chess) : new Map()), [fen, canMove, chess]);

  if (!profile) return null;
  const best = results?.get(drill.id);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-150px))]">
        <Board
          fen={fen}
          orientation={userColor}
          turnColor={colorOf(chess.turn())}
          movable={canMove ? userColor : undefined}
          dests={dests}
          lastMove={lastMove}
          check={chess.inCheck()}
          coordinates={profile.settings.coordinates}
          animation={profile.settings.animation}
          theme={profile.settings.boardTheme}
          syncKey={syncKey}
          isPromotion={(o, d) => isPromotionMove(chess, o, d)}
          onMove={(o, d, p) => {
            if (!game.userMove(toUci(o, d, p))) setSyncKey((k) => k + 1);
          }}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <Link to="/train/drills" className="link text-sm">
          ← Tất cả drills
        </Link>
        <div className="card">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-bold">{drill.title}</h1>
            <Stars n={best?.stars ?? 0} />
          </div>
          <div className="text-sm text-accent">
            Mục tiêu: {GOAL_LABEL[drill.goal]}
            {drill.goal === 'draw' ? ` trong ${drill.par} nước` : ` · 3★ nếu ≤ ${drill.par} nước`}
          </div>
          <p className="mt-2 text-sm text-muted">{drill.desc}</p>
          <div className="mt-2 text-sm">
            Bạn cầm <b>{userColor === 'white' ? 'Trắng' : 'Đen'}</b> · đã đi {userMoves} nước
            {game.thinking && <span className="text-muted"> · Stockfish đang nghĩ…</span>}
            {checking && <span className="text-muted"> · đang kiểm tra…</span>}
          </div>
        </div>
        {outcome && (
          <div className={`card text-center ${outcome.success ? 'bg-good/20' : 'bg-bad/20'}`}>
            <div className="text-xl font-extrabold">{outcome.success ? 'Hoàn thành!' : 'Chưa đạt'}</div>
            {outcome.stars !== undefined && (
              <div className="text-2xl">
                <Stars n={outcome.stars} />
              </div>
            )}
            <div className="text-sm text-muted">{outcome.text}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setShowHint(true)} disabled={showHint}>
            💡 Gợi ý
          </button>
          <button className={`btn ${outcome && !outcome.success ? 'btn-primary' : ''}`} onClick={onRetry}>
            ↺ Làm lại
          </button>
        </div>
        {showHint && <div className="card text-sm">{drill.hint}</div>}
        <MoveTable
          moves={moves.map((m) => ({ san: m.san }))}
          current={moves.length - 1}
          firstPly={userColor === 'black' ? 1 : 0}
        />
      </aside>
    </div>
  );
}

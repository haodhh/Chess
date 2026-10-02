import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { EvalBar } from '../../components/EvalBar';
import { EvalGraph } from '../../components/EvalGraph';
import { MoveTable } from '../../components/MoveTable';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { analyseGame } from '../../engine/analyseGame';
import { getEngine } from '../../engine/engine';
import { CLASS_INFO, reviewGame, sideAccuracy, type MoveClass, type MoveReview } from '../../engine/review';
import { formatScore, negate, winPercent, type Score } from '../../engine/uci';
import { bookPlies, epdOf, loadOpenings, openingOf, type Opening } from '../../data/openings';
import { currentRating, useProfile } from '../../data/store';
import { addPersonalPuzzle, saveAnalysis, useGame } from '../../data/train';
import { pvToSan } from './Analysis';

const DEPTH = 12;
const COUNTED: MoveClass[] = ['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

interface Parsed {
  startFen: string;
  moves: Move[];
  fens: string[];
}

function parseGame(pgn: string): Parsed | null {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
  } catch {
    return null;
  }
  const moves = c.history({ verbose: true });
  const startFen = moves[0]?.before ?? c.fen();
  return { startFen, moves, fens: [startFen, ...moves.map((m) => m.after)] };
}

const uciOf = (m: Move) => m.from + m.to + (m.promotion ?? '');

export function GameReview() {
  const { id } = useParams();
  const game = useGame(Number(id));
  const profile = useProfile();
  const navigate = useNavigate();
  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [ply, setPly] = useState(-1);
  const [opening, setOpening] = useState<Opening | undefined>();
  const [retry, setRetry] = useState<{ ply: number; message?: string; ok?: boolean; syncKey: number } | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const started = useRef(false);

  // Analyse once and store the result with the game.
  useEffect(() => {
    if (!game || !parsed || game.analysis || started.current) return;
    started.current = true;
    (async () => {
      const book = await loadOpenings().catch(() => null);
      const positions = await analyseGame(parsed.fens, DEPTH, (d, t) => setProgress([d, t]));
      const uci = parsed.moves.map(uciOf);
      const standardStart = parsed.startFen === new Chess().fen();
      const plies = book && standardStart ? bookPlies(book, uci, parsed.fens.slice(1).map(epdOf)) : 0;
      const reviews = reviewGame(uci, positions, plies);
      await saveAnalysis(game.id!, {
        depth: DEPTH,
        positions,
        bookPlies: plies,
        accuracy: { white: sideAccuracy(reviews, 'white'), black: sideAccuracy(reviews, 'black') },
      });
      setProgress(null);
    })().catch((e) => {
      console.error(e);
      setProgress(null);
    });
  }, [game, parsed]);

  useEffect(() => {
    if (!parsed || parsed.startFen !== new Chess().fen()) return;
    loadOpenings()
      .then((b) => setOpening(openingOf(b, parsed.fens.slice(1).map(epdOf))))
      .catch(() => undefined);
  }, [parsed]);

  useEffect(() => () => getEngine().cancelAll(), []);

  const reviews = useMemo<MoveReview[] | null>(() => {
    if (!game?.analysis || !parsed) return null;
    return reviewGame(parsed.moves.map(uciOf), game.analysis.positions, game.analysis.bookPlies);
  }, [game, parsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!parsed || retry) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(-1, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(parsed.moves.length - 1, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parsed, retry]);

  const userColor: Color = game?.userColor ?? 'white';
  const isUserPly = (p: number) => (p % 2 === 0) === (colorOf(new Chess(parsed?.startFen).turn()) === userColor);
  const keyMoments = (reviews ?? []).filter((r) => isUserPly(r.ply) && (r.cls === 'mistake' || r.cls === 'blunder'));

  if (game === undefined || !profile) return null;
  if (game === null || !parsed) {
    return (
      <div className="card">
        Không tìm thấy ván cờ này. <Link className="link" to="/train/games">Về danh sách ván</Link>
      </div>
    );
  }

  // In retry mode the board shows the position before the mistake and the user plays.
  const viewPly = retry ? retry.ply - 1 : ply;
  const fen = parsed.fens[viewPly + 1];
  const chess = new Chess(fen);
  const turn = colorOf(chess.turn());
  const move = viewPly >= 0 ? parsed.moves[viewPly] : undefined;
  const review = !retry && ply >= 0 ? reviews?.[ply] : undefined;
  const positionEval = game.analysis?.positions[viewPly + 1];
  const whiteEval: Score | null = positionEval ? (turn === 'white' ? positionEval.score : negate(positionEval.score)) : null;

  const shapes: DrawShape[] = [];
  if (!retry && review?.bestMove && review.cls !== 'best' && review.cls !== 'book') {
    const { from, to } = parseUci(review.bestMove);
    shapes.push({ orig: from, dest: to, brush: 'green' });
  }

  const onRetryMove = async (o: Key, d: Key, p?: 'q' | 'r' | 'b' | 'n') => {
    if (!retry || !reviews) return;
    const uci = toUci(o, d, p);
    const before = game.analysis!.positions[retry.ply];
    const c = new Chess(fen);
    let san = '';
    try {
      san = c.move(parseUci(uci)).san;
    } catch {
      setRetry({ ...retry, syncKey: retry.syncKey + 1 });
      return;
    }
    setRetry({ ...retry, message: `Đang kiểm tra ${san}…` });
    const after = c.isCheckmate()
      ? ({ mate: -1 } as Score)
      : (await getEngine().analyse(c.fen(), { depth: DEPTH }, true)).score;
    const drop = winPercent(before.score) - winPercent(negate(after));
    const ok = uci === before.best || drop <= 5;
    playSound(ok ? 'success' : 'error');
    setRetry({
      ...retry,
      ok,
      syncKey: retry.syncKey + 1,
      message: ok ? `${san} là nước tốt! 🎉` : `${san} vẫn chưa tốt (mất ${Math.round(drop)}% cơ hội thắng). Thử lại nhé.`,
    });
  };

  const saveMistakes = async () => {
    let n = 0;
    const rating = Math.round(currentRating(profile).rating);
    for (const r of keyMoments) {
      if (r.ply < 1 || !r.bestMove) continue;
      const added = await addPersonalPuzzle({
        id: `g${game.id}-${r.ply}`,
        fen: parsed.fens[r.ply - 1],
        moves: [uciOf(parsed.moves[r.ply - 1]), r.bestMove],
        rating,
        themes: ['ownGame'],
      });
      if (added) n++;
    }
    setSaved(n);
  };

  const counts = (color: Color) => {
    const m = new Map<MoveClass, number>();
    for (const r of reviews ?? []) {
      if ((r.ply % 2 === 0) === (colorOf(new Chess(parsed.startFen).turn()) === color)) m.set(r.cls, (m.get(r.cls) ?? 0) + 1);
    }
    return m;
  };
  const graph = game.analysis
    ? game.analysis.positions.map((pe, i) => {
        const t = new Chess(parsed.fens[i]).turn();
        return winPercent(t === 'w' ? pe.score : negate(pe.score));
      })
    : [];
  const graphMarks = new Map<number, string>();
  for (const r of reviews ?? []) if (r.cls === 'mistake' || r.cls === 'blunder') graphMarks.set(r.ply + 1, CLASS_INFO[r.cls].color);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-150px))] flex-col gap-2">
        <div className="flex gap-2">
          <EvalBar score={whiteEval} orientation={userColor} />
          <div className="flex-1">
            <Board
              fen={fen}
              orientation={userColor}
              turnColor={turn}
              movable={retry && !retry.ok ? turn : undefined}
              dests={retry && !retry.ok ? legalDests(chess) : undefined}
              lastMove={move && !retry ? [move.from, move.to] : undefined}
              check={chess.inCheck()}
              shapes={shapes}
              coordinates={profile.settings.coordinates}
              animation={profile.settings.animation}
              theme={profile.settings.boardTheme}
              syncKey={retry?.syncKey}
              isPromotion={(o, d) => isPromotionMove(chess, o, d)}
              onMove={onRetryMove}
            />
          </div>
        </div>
        {graph.length > 1 && <EvalGraph values={graph} current={viewPly + 1} marks={graphMarks} onSelect={(i) => !retry && setPly(i - 1)} />}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="card">
          <div className="text-sm text-muted">
            {game.white} – {game.black} · <b className="text-white">{game.result}</b>
          </div>
          {opening && (
            <div className="text-xs text-muted">
              {opening.eco} · {opening.name}
            </div>
          )}
          {progress && (
            <div className="mt-3">
              <div className="mb-1 text-sm">
                Stockfish đang phân tích… {progress[0]}/{progress[1]}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-accent transition-all" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
              </div>
            </div>
          )}
          {game.analysis && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              {(['white', 'black'] as const).map((c) => (
                <div key={c} className={`rounded-lg p-2 ${c === userColor ? 'bg-accent/20' : 'bg-panel-2'}`}>
                  <div className="text-xs text-muted">
                    {c === 'white' ? 'Trắng' : 'Đen'}
                    {c === userColor && ' (bạn)'}
                  </div>
                  <div className="text-2xl font-extrabold">{game.analysis!.accuracy[c].toFixed(1)}</div>
                  <div className="text-[10px] text-muted">độ chính xác</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {retry ? (
          <div className={`card ${retry.ok ? 'bg-good/20' : ''}`}>
            <div className="font-bold">🔁 Thử lại nước {Math.floor(retry.ply / 2) + 1}</div>
            <p className="text-sm text-muted">
              {retry.message ?? `Bạn đã đi ${parsed.moves[retry.ply].san}. Hãy tìm nước tốt hơn.`}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!retry.ok && (
                <button
                  className="btn btn-sm py-2"
                  onClick={() => {
                    const best = game.analysis!.positions[retry.ply].best;
                    setRetry({ ...retry, ok: true, message: `Nước tốt nhất: ${best ? pvToSan(fen, [best])[0] : '?'}` });
                  }}
                >
                  Xem đáp án
                </button>
              )}
              <button
                className="btn btn-sm py-2"
                onClick={() => {
                  setPly(retry.ply);
                  setRetry(null);
                }}
              >
                Quay lại phân tích
              </button>
            </div>
          </div>
        ) : (
          review &&
          move && (
            <div className="card">
              <div className="flex items-center gap-2">
                <span className="rounded px-2 py-0.5 text-sm font-bold text-black" style={{ background: CLASS_INFO[review.cls].color }}>
                  {CLASS_INFO[review.cls].icon}
                </span>
                <span>
                  <b>{move.san}</b> là nước <b>{CLASS_INFO[review.cls].label.toLowerCase()}</b>
                </span>
              </div>
              {positionEval && <div className="mt-1 text-xs text-muted">Đánh giá sau nước này: {whiteEval ? formatScore(whiteEval) : ''}</div>}
              {review.bestMove && review.cls !== 'best' && review.cls !== 'book' && (
                <div className="mt-1 text-sm">
                  Nước tốt nhất: <b className="text-accent">{pvToSan(parsed.fens[ply], [review.bestMove])[0]}</b>
                </div>
              )}
              {isUserPly(ply) && (review.cls === 'mistake' || review.cls === 'blunder' || review.cls === 'inaccuracy') && (
                <button className="btn btn-sm mt-2 py-2" onClick={() => setRetry({ ply, syncKey: 0 })}>
                  🔁 Thử lại nước này
                </button>
              )}
            </div>
          )
        )}

        {reviews && (
          <div className="card">
            <div className="mb-2 font-semibold">Thống kê nước đi</div>
            <table className="w-full text-sm">
              <tbody>
                {COUNTED.map((cls) => {
                  const w = counts('white').get(cls) ?? 0;
                  const b = counts('black').get(cls) ?? 0;
                  if (w + b === 0) return null;
                  return (
                    <tr key={cls}>
                      <td className="w-10 text-center tabular-nums">{w}</td>
                      <td>
                        <span className="font-bold" style={{ color: CLASS_INFO[cls].color }}>
                          {CLASS_INFO[cls].icon}
                        </span>{' '}
                        {CLASS_INFO[cls].label}
                      </td>
                      <td className="w-10 text-center tabular-nums">{b}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {keyMoments.length > 0 && (
          <div className="card">
            <div className="mb-2 font-semibold">Thời điểm quan trọng của bạn</div>
            <div className="flex flex-wrap gap-2">
              {keyMoments.map((r) => (
                <button key={r.ply} className="btn btn-sm" onClick={() => { setRetry(null); setPly(r.ply); }}>
                  <span style={{ color: CLASS_INFO[r.cls].color }}>{CLASS_INFO[r.cls].icon}</span>
                  {Math.floor(r.ply / 2) + 1}
                  {r.ply % 2 === 0 ? '.' : '…'} {parsed.moves[r.ply].san}
                </button>
              ))}
            </div>
            <button className="btn btn-sm mt-3 w-full py-2" onClick={saveMistakes} disabled={saved !== null}>
              {saved === null ? '➕ Đưa các lỗi này vào Ôn lỗi' : `Đã thêm ${saved} thế cờ vào Ôn lỗi`}
            </button>
          </div>
        )}

        <MoveTable
          moves={parsed.moves.map((m, i) => {
            const r = reviews?.[i];
            const show = r && r.cls !== 'best' && r.cls !== 'excellent' && r.cls !== 'good';
            return {
              san: m.san,
              mark: show ? { icon: CLASS_INFO[r!.cls].icon, color: CLASS_INFO[r!.cls].color, title: CLASS_INFO[r!.cls].label } : undefined,
            };
          })}
          current={ply}
          onSelect={(i) => {
            setRetry(null);
            setPly(i);
          }}
          firstPly={new Chess(parsed.startFen).turn() === 'b' ? 1 : 0}
        />
        <div className="grid grid-cols-4 gap-2">
          <button className="btn btn-sm py-2" onClick={() => setPly(-1)}>⏮</button>
          <button className="btn btn-sm py-2" onClick={() => setPly((p) => Math.max(-1, p - 1))}>◀</button>
          <button className="btn btn-sm py-2" onClick={() => setPly((p) => Math.min(parsed.moves.length - 1, p + 1))}>▶</button>
          <button className="btn btn-sm py-2" onClick={() => navigate(`/train/analysis?fen=${encodeURIComponent(fen)}`)} title="Mở trên bàn phân tích">
            🔍
          </button>
        </div>
      </aside>
    </div>
  );
}

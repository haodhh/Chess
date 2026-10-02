import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { addRepertoireLine } from '../../data/learn';
import { epdOf, loadOpenings, nodeAt, openingOf, type OpeningBook, type OpeningNode } from '../../data/openings';
import { useProfile } from '../../data/store';

const POPULAR = [
  "Italian Game",
  'Ruy Lopez',
  'Sicilian Defense',
  'French Defense',
  'Caro-Kann Defense',
  "Queen's Gambit Declined",
  "King's Indian Defense",
  'London System',
  'English Opening',
  'Scandinavian Defense',
];

/** Name of the first named opening at or below a node (breadth-first). */
function firstName(node: OpeningNode): string | undefined {
  const queue = [node];
  while (queue.length) {
    const n = queue.shift()!;
    if (n.opening) return n.opening.name;
    queue.push(...[...n.children.values()].sort((a, b) => b.lines - a.lines));
  }
  return undefined;
}

export function Openings() {
  const profile = useProfile();
  const [book, setBook] = useState<OpeningBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Color>('white');
  const [query, setQuery] = useState('');
  const [syncKey, setSyncKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadOpenings().then(setBook, (e) => setError(String(e)));
  }, []);

  const chess = useMemo(() => {
    const c = new Chess();
    for (const m of moves) c.move(parseUci(m));
    return c;
  }, [moves]);
  const history = chess.history({ verbose: true });
  const epds = useMemo(() => history.map((m) => epdOf(m.after)), [moves]);
  const fen = chess.fen();
  const dests = useMemo(() => legalDests(chess), [chess]);
  const last = history[history.length - 1];
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);

  if (error) return <div className="card text-bad">{error}</div>;
  if (!profile || !book) return <div className="text-muted">Đang tải dữ liệu khai cuộc…</div>;

  const node = nodeAt(book, moves);
  const current = openingOf(book, epds);
  const continuations = node
    ? [...node.children.entries()]
        .sort((a, b) => b[1].lines - a[1].lines)
        .map(([uci, child]) => {
          const c = new Chess(fen);
          const san = c.move(parseUci(uci)).san;
          return { uci, san, name: child.opening?.name ?? firstName(child), lines: child.lines };
        })
    : [];
  const results = query.trim().length >= 2 ? book.list.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30) : [];

  const play = (uci: string) => {
    try {
      const m = new Chess(fen).move(parseUci(uci));
      playSound(m.captured ? 'capture' : 'move');
      setMoves([...moves, uci]);
      setMessage(null);
    } catch {
      setSyncKey((k) => k + 1);
    }
  };

  const save = async (color: Color) => {
    const name = current?.name ?? 'Khai cuộc của tôi';
    const added = await addRepertoireLine(name, color, moves);
    setMessage(added ? `Đã thêm "${name}" vào repertoire (${color === 'white' ? 'Trắng' : 'Đen'}).` : 'Dòng này đã có trong repertoire.');
  };

  return (
    <div className="game-layout">
      <div className="board-col">
        <Board
          fen={fen}
          orientation={orientation}
          turnColor={colorOf(chess.turn())}
          movable={colorOf(chess.turn())}
          dests={dests}
          lastMove={lastMove}
          check={chess.inCheck()}
          coordinates={profile.settings.coordinates}
          animation={profile.settings.animation}
          theme={profile.settings.boardTheme}
          syncKey={syncKey}
          isPromotion={(o, d) => isPromotionMove(chess, o, d)}
          onMove={(o, d, p) => play(toUci(o, d, p))}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="card">
          <h1 className="text-lg font-bold">📖 Cây khai cuộc</h1>
          <div className="mt-1 text-sm">
            {current ? (
              <>
                <span className="text-muted">{current.eco}</span> <b>{current.name}</b>
              </>
            ) : (
              <span className="text-muted">Thế cờ ban đầu. Hãy đi một nước hoặc chọn bên dưới.</span>
            )}
          </div>
          <div className="mt-2 font-mono text-xs text-muted">{history.map((m, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${m.san}`).join(' ')}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button className="btn btn-sm py-2" onClick={() => setMoves(moves.slice(0, -1))} disabled={moves.length === 0}>
              ◀ Lùi
            </button>
            <button className="btn btn-sm py-2" onClick={() => setMoves([])} disabled={moves.length === 0}>
              ⏮ Đầu
            </button>
            <button className="btn btn-sm py-2" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
              ⇅ Lật
            </button>
          </div>
        </div>

        <div className="card">
          <div className="mb-2 font-semibold">{node ? 'Các tiếp diễn có tên' : 'Đã ra khỏi lý thuyết khai cuộc'}</div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {continuations.map((c) => (
              <button key={c.uci} className="flex min-w-0 items-center gap-2 rounded px-2 py-2.5 text-left text-sm hover:bg-white/10 lg:py-1" onClick={() => play(c.uci)}>
                <b className="w-14 shrink-0 font-mono">{c.san}</b>
                <span className="flex-1 truncate text-muted">{c.name}</span>
                <span className="text-xs text-muted">{c.lines}</span>
              </button>
            ))}
            {node && continuations.length === 0 && <div className="text-sm text-muted">Hết biến có tên ở nhánh này.</div>}
          </div>
        </div>

        {moves.length > 0 && (
          <div className="card">
            <div className="mb-2 text-sm">Thêm dòng này vào repertoire để luyện ghi nhớ:</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-sm py-2" onClick={() => save('white')}>
                ♔ Tôi cầm Trắng
              </button>
              <button className="btn btn-sm py-2" onClick={() => save('black')}>
                ♚ Tôi cầm Đen
              </button>
            </div>
            {message && <div className="mt-2 text-sm text-good">{message}</div>}
          </div>
        )}

        <div className="card">
          <input
            className="w-full rounded-lg bg-panel-2 px-3 py-2 text-sm"
            placeholder="Tìm khai cuộc (vd. Sicilian, London…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
            {(results.length ? results : POPULAR.map((n) => book.list.find((o) => o.name === n || o.name.startsWith(`${n}:`))).filter(Boolean)).map(
              (o) =>
                o && (
                  <button
                    key={o.eco + o.name}
                    className="flex min-w-0 gap-2 rounded px-2 py-2.5 text-left text-sm hover:bg-white/10 lg:py-1"
                    onClick={() => {
                      setMoves(o.uci);
                      setQuery('');
                    }}
                  >
                    <span className="w-10 shrink-0 text-muted">{o.eco}</span>
                    <span className="truncate">{o.name}</span>
                  </button>
                ),
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

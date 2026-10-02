import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PuzzleTrainer } from '../components/PuzzleTrainer';
import { lengthStats } from '../core/stats';
import { loadIndex, MAX_MOVES, type PuzzleIndex } from '../data/puzzleData';
import { useAttempts } from '../data/store';

const COUNTS = Array.from({ length: MAX_MOVES }, (_, i) => i + 1);

const LEVEL: Record<number, string> = {
  1: 'Khởi động',
  2: 'Dễ',
  3: 'Vừa',
  4: 'Khá khó',
  5: 'Khó',
  6: 'Rất khó',
  7: 'Chuyên gia',
  8: 'Chuyên gia',
  9: 'Bậc thầy',
  10: 'Bậc thầy',
};

const movesTitle = (n: number, mate: boolean) => `${mate ? 'Chiếu hết' : 'Thắng'} trong ${n} nước`;

function usePuzzleIndex() {
  const [index, setIndex] = useState<PuzzleIndex | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, () => setIndex(null));
  }, []);
  return index;
}

const countFor = (index: PuzzleIndex | null, n: number, mate: boolean) =>
  (mate ? index?.mateLengthCounts : index?.lengthCounts)?.[n];

const href = (n: number, mate: boolean) => `/moves/${n}${mate ? '?mate=1' : ''}`;

function MateToggle({ mate, onChange }: { mate: boolean; onChange: (mate: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1 text-sm font-semibold" role="radiogroup" aria-label="Loại bài">
      {[false, true].map((m) => (
        <button
          key={String(m)}
          role="radio"
          aria-checked={mate === m}
          className={`min-h-9 rounded-md px-3 ${mate === m ? 'bg-accent text-white' : 'text-stone-300 hover:bg-white/10'}`}
          onClick={() => onChange(m)}
        >
          {m ? '♚ Chỉ chiếu hết' : '🏆 Tất cả'}
        </button>
      ))}
    </div>
  );
}

/** Picks puzzles by how many moves the solution takes: win (or mate) in 1 … 10. */
export function MoveCounts() {
  const index = usePuzzleIndex();
  const attempts = useAttempts();
  const [params, setParams] = useSearchParams();
  const mate = params.get('mate') === '1';
  const stats = useMemo(() => lengthStats(attempts ?? [], mate), [attempts, mate]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Puzzle theo số nước</h1>
      <p className="mb-4 text-muted">
        Mỗi bài cần tìm đúng số nước đi của bạn để thắng: chiếu hết, hoặc giành lợi thế quyết định (ăn quân, phong hậu…). Càng
        nhiều nước càng phải tính xa. Kết quả vẫn tính vào rating.
      </p>
      <div className="mb-4 max-w-md">
        <MateToggle mate={mate} onChange={(m) => setParams(m ? { mate: '1' } : {}, { replace: true })} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {COUNTS.map((n) => {
          const count = countFor(index, n, mate);
          const empty = index !== null && !count;
          const s = stats.get(n);
          const body = (
            <>
              <div className="flex items-baseline gap-1.5" title={movesTitle(n, mate)}>
                <span className="text-3xl font-extrabold text-accent">{n}</span>
                <span className="font-semibold">nước{mate && ' ♚'}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {LEVEL[n]}
                {count !== undefined && ` · ${count.toLocaleString('vi-VN')} bài`}
                {empty && ' · chưa có bài'}
              </div>
              {s && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(s.solved / s.attempts) * 100}%` }} />
                  </div>
                  <span className="text-muted">
                    {s.solved}/{s.attempts}
                  </span>
                </div>
              )}
            </>
          );
          return empty ? (
            <div key={n} className="card !p-3 opacity-40 sm:!p-4">
              {body}
            </div>
          ) : (
            <Link key={n} to={href(n, mate)} className="card block !p-3 transition-colors hover:bg-panel-2 sm:!p-4">
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Rated puzzles that take exactly `n` moves, with a picker to switch the count. */
export function MovePuzzles() {
  const n = Math.min(MAX_MOVES, Math.max(1, Math.round(Number(useParams().n)) || 1));
  const [params] = useSearchParams();
  const mate = params.get('mate') === '1';
  const index = usePuzzleIndex();

  const picker = (
    <div className="mb-3 border-b border-white/10 pb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-bold">
          {mate ? '♚' : '🏆'} {movesTitle(n, mate)}
        </div>
        <Link to={href(n, !mate)} replace className="btn btn-sm shrink-0">
          {mate ? 'Xem tất cả' : 'Chỉ chiếu hết'}
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-1" aria-label="Số nước">
        {COUNTS.map((k) => {
          const empty = index !== null && !countFor(index, k, mate);
          return (
            <Link
              key={k}
              to={href(k, mate)}
              replace
              aria-current={k === n ? 'page' : undefined}
              className={`flex h-9 items-center justify-center rounded-md text-sm font-bold ${
                k === n ? 'bg-accent text-white' : 'bg-panel-2 hover:bg-white/15'
              } ${empty ? 'pointer-events-none opacity-30' : ''}`}
            >
              {k}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <Link to={mate ? '/moves?mate=1' : '/moves'} className="back-link mb-1">
        ← Chọn số nước
      </Link>
      <PuzzleTrainer key={`${n}-${mate}`} mode="moves" moves={n} mateOnly={mate} top={picker} />
    </div>
  );
}

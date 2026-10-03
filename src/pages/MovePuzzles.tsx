import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
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

const title = (n: number) => `Chiếu hết trong ${n} nước`;

function usePuzzleIndex() {
  const [index, setIndex] = useState<PuzzleIndex | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, () => setIndex(null));
  }, []);
  return index;
}

const countFor = (index: PuzzleIndex | null, n: number) => index?.mateLengthCounts?.[n];

/** Mates in 1 … 10 of the solver's moves. */
export function MoveCounts() {
  const index = usePuzzleIndex();
  const attempts = useAttempts();
  const stats = useMemo(() => lengthStats(attempts ?? [], true), [attempts]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Chiếu hết trong N nước</h1>
      <p className="mb-4 text-muted">
        Mỗi bài là một thế cờ từ ván đấu thật, có cách chiếu hết bắt buộc sau đúng N nước của bạn dù đối thủ chống đỡ tốt nhất.
        Bài chỉ hoàn thành khi bạn chiếu hết. Kết quả vẫn tính vào rating.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {COUNTS.map((n) => {
          const count = countFor(index, n);
          const empty = index !== null && !count;
          const s = stats.get(n);
          const body = (
            <>
              <div className="flex items-baseline gap-1.5" title={title(n)}>
                <span className="text-3xl font-extrabold text-accent">{n}</span>
                <span className="font-semibold">nước</span>
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
            <Link key={n} to={`/moves/${n}`} className="card block !p-3 transition-colors hover:bg-panel-2 sm:!p-4">
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Rated mates in exactly `n` moves, with a picker to switch the count. */
export function MovePuzzles() {
  const n = Math.min(MAX_MOVES, Math.max(1, Math.round(Number(useParams().n)) || 1));
  const index = usePuzzleIndex();

  const picker = (
    <div className="mb-3 border-b border-white/10 pb-3">
      <div className="mb-2 font-bold">♚ {title(n)}</div>
      <div className="grid grid-cols-5 gap-1" aria-label="Số nước">
        {COUNTS.map((k) => {
          const empty = index !== null && !countFor(index, k);
          return (
            <Link
              key={k}
              to={`/moves/${k}`}
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
      <Link to="/moves" className="back-link mb-1">
        ← Chọn số nước
      </Link>
      <PuzzleTrainer key={n} mode="moves" moves={n} mateOnly top={picker} />
    </div>
  );
}

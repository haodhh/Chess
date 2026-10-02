import { Link } from 'react-router';
import { LESSONS, UNITS } from '../../content/lessons';
import { useLessonProgress, useRepertoire } from '../../data/learn';

export function LearnHub() {
  const progress = useLessonProgress();
  const repertoire = useRepertoire();
  const due = repertoire?.filter((r) => r.due <= Date.now()).length ?? 0;
  const firstUndone = LESSONS.find((l) => !progress?.has(l.id));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-extrabold">🎓 Học</h1>
      <p className="mb-5 text-muted">Bài học tương tác ngắn: đọc giải thích, rồi tự đi quân trên bàn cờ. Mỗi bài chỉ mất 3–5 phút.</p>

      {firstUndone && (
        <Link to={`/learn/lesson/${firstUndone.id}`} className="btn btn-primary mb-6 w-full py-4 text-lg">
          {firstUndone.icon} Học tiếp: {firstUndone.title}
        </Link>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link to="/learn/openings" className="card block transition-colors hover:bg-panel-2">
          <div className="text-3xl">📖</div>
          <div className="mt-1 text-lg font-bold">Cây khai cuộc</div>
          <div className="text-sm text-muted">Hơn 3.800 biến khai cuộc có tên. Đi thử nước để xem tên và các tiếp diễn.</div>
        </Link>
        <Link to="/learn/repertoire" className="card block transition-colors hover:bg-panel-2">
          <div className="flex items-start justify-between">
            <span className="text-3xl">🧠</span>
            {due > 0 && <span className="rounded-full bg-bad px-2 py-0.5 text-xs text-white">{due} dòng đến hạn</span>}
          </div>
          <div className="mt-1 text-lg font-bold">Repertoire của bạn</div>
          <div className="text-sm text-muted">Ghi nhớ các biến khai cuộc bạn chọn bằng lặp lại ngắt quãng ({repertoire?.length ?? 0} dòng).</div>
        </Link>
      </div>

      {UNITS.map((unit) => {
        const lessons = LESSONS.filter((l) => l.unit === unit.id);
        const done = lessons.filter((l) => progress?.has(l.id)).length;
        return (
          <section key={unit.id} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{unit.title}</h2>
              <span className="text-sm text-muted">
                {done}/{lessons.length} bài
              </span>
            </div>
            <p className="mb-3 text-sm text-muted">{unit.desc}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {lessons.map((l) => {
                const p = progress?.get(l.id);
                return (
                  <Link key={l.id} to={`/learn/lesson/${l.id}`} className="card flex items-center gap-3 transition-colors hover:bg-panel-2">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${p ? 'bg-accent/30' : 'bg-white/5'}`}>
                      {l.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.title}</span>
                      <span className="block truncate text-xs text-muted">{l.summary}</span>
                    </span>
                    {p && (
                      <span className="text-sm text-warn">
                        {'★'.repeat(p.stars)}
                        <span className="text-white/20">{'★'.repeat(3 - p.stars)}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import { Link } from 'react-router';
import { DRILLS } from '../../data/drills';
import { useDrillResults, useGames, useVisionBest } from '../../data/train';

export function TrainHub() {
  const games = useGames();
  const drills = useDrillResults();
  const vision = useVisionBest();
  const stars = [...(drills?.values() ?? [])].reduce((s, r) => s + r.stars, 0);
  const visionBest = Math.max(0, ...Object.values(vision ?? {}));
  const unreviewed = games?.filter((g) => !g.analysis).length ?? 0;

  const items = [
    { to: '/train/play', icon: '🤖', title: 'Chơi với máy', desc: '7 mức độ từ 400 đến Stockfish tối đa, có gợi ý và đi lại.' },
    {
      to: '/train/games',
      icon: '📚',
      title: 'Phân tích ván',
      desc: 'Xem lại các ván đã chơi, tìm sai lầm và luyện lại chính lỗi của bạn.',
      badge: unreviewed > 0 ? `${unreviewed} ván chưa phân tích` : `${games?.length ?? 0} ván`,
    },
    { to: '/train/drills', icon: '🏁', title: 'Drills', desc: 'Chiếu hết cơ bản và tàn cuộc kinh điển với Stockfish.', badge: `${stars}/${DRILLS.length * 3} ★` },
    { to: '/train/vision', icon: '🎯', title: 'Luyện tọa độ', desc: 'Nhận diện ô cờ thật nhanh trong 30 giây.', badge: `Kỷ lục ${visionBest}` },
    { to: '/train/analysis', icon: '🔍', title: 'Bàn phân tích', desc: 'Tự do bày thế cờ, xem đánh giá và các biến của Stockfish.' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-extrabold">🏋️ Luyện tập</h1>
      <p className="mb-5 text-muted">Chơi, phân tích và luyện lại các tình huống. Engine Stockfish chạy ngay trong trình duyệt của bạn.</p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="card block !p-3 transition-colors hover:bg-panel-2 sm:!p-4">
            <div className="flex items-start justify-between">
              <span className="text-3xl">{i.icon}</span>
              {i.badge && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] sm:text-xs">{i.badge}</span>}
            </div>
            <div className="mt-2 leading-tight font-bold sm:text-lg">{i.title}</div>
            <div className="mt-0.5 text-xs text-muted sm:text-sm">{i.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

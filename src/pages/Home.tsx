import { useMemo } from 'react';
import { Link } from 'react-router';
import { useNow } from '../components/Layout';
import { Onboarding } from '../components/Onboarding';
import { isProvisional } from '../core/glicko2';
import { attemptsToday, streakDays, themeStats, weakestThemes } from '../core/stats';
import { themeName } from '../core/themes';
import { currentRating, useAttempts, useDueCount, useProfile, useRushBest } from '../data/store';

export function Home() {
  const profile = useProfile();
  const attempts = useAttempts();
  const due = useDueCount(useNow()) ?? 0;
  const best = useRushBest();
  const weakest = useMemo(() => weakestThemes(themeStats(attempts ?? []), 1)[0], [attempts]);

  if (!profile || !attempts) return null;
  if (!profile.onboarded) return <Onboarding />;

  const rating = currentRating(profile);
  const today = attemptsToday(attempts).length;
  const goal = profile.settings.dailyGoal;
  const streak = streakDays(attempts);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-sm text-muted">Rating puzzle</div>
          <div className="text-4xl font-extrabold">
            {Math.round(rating.rating)}
            {isProvisional(rating) && <span className="text-muted">?</span>}
          </div>
          <div className="mt-3 text-sm">
            Hôm nay: <b>{today}</b>/{goal} puzzle {today >= goal && '✅'}
          </div>
          <div className="mt-1 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-3xl font-extrabold">{streak}🔥</div>
            <div className="text-xs text-muted">ngày liên tiếp</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">{best?.['3m'] ?? 0}</div>
            <div className="text-xs text-muted">kỷ lục Rush</div>
          </div>
        </div>
      </section>

      <Link to="/puzzles" className="btn btn-primary py-5 text-xl">
        🧩 Giải puzzle
      </Link>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile to="/review" icon="🔁" title="Ôn lỗi" desc={due > 0 ? `${due} bài đến hạn ôn` : 'Không có bài đến hạn'} highlight={due > 0} />
        <Tile to="/rush" icon="⚡" title="Puzzle Rush" desc="Giải nhanh trong 3 hoặc 5 phút" />
        <Tile to="/daily" icon="📅" title="Puzzle hằng ngày" desc="Mỗi ngày một bài" />
        <Tile
          to={weakest ? `/themes/${weakest.theme}` : '/themes'}
          icon="🎯"
          title={weakest ? `Luyện: ${themeName(weakest.theme)}` : 'Theo chủ đề'}
          desc={weakest ? `Chủ đề yếu nhất (${Math.round(weakest.rate * 100)}% đúng)` : 'Chĩa đôi, ghim, chiếu hết…'}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Luyện tập & Học</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile to="/train/play" icon="🤖" title="Chơi với máy" desc="7 mức độ, có gợi ý" />
          <Tile to="/train/games" icon="📚" title="Phân tích ván" desc="Tìm lỗi trong ván của bạn" />
          <Tile to="/train/drills" icon="🏁" title="Drills" desc="Chiếu hết & tàn cuộc kinh điển" />
          <Tile to="/learn" icon="🎓" title="Học" desc="Bài học tương tác theo lộ trình" />
        </div>
      </section>
    </div>
  );
}

function Tile(props: { to: string; icon: string; title: string; desc: string; highlight?: boolean; muted?: boolean }) {
  return (
    <Link
      to={props.to}
      className={`card block transition-colors hover:bg-panel-2 ${props.highlight ? 'border border-bad/60' : ''} ${props.muted ? 'opacity-60' : ''}`}
    >
      <div className="text-2xl">{props.icon}</div>
      <div className="mt-1 font-bold">{props.title}</div>
      <div className="text-sm text-muted">{props.desc}</div>
    </Link>
  );
}

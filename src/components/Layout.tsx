import { NavLink, Outlet } from 'react-router';
import { useDueCount } from '../data/store';
import { ErrorBoundary } from './ErrorBoundary';
import { SyncStatus } from './SyncStatus';
import { useNow } from './useNow';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', icon: '🏠', label: 'Trang chủ' },
  { to: '/puzzles', icon: '🧩', label: 'Puzzle' },
  { to: '/themes', icon: '🎯', label: 'Chủ đề' },
  { to: '/rush', icon: '⚡', label: 'Rush' },
  { to: '/review', icon: '🔁', label: 'Ôn lỗi' },
  { to: '/daily', icon: '📅', label: 'Hằng ngày' },
  { to: '/stats', icon: '📈', label: 'Thống kê' },
  { to: '/train', icon: '🏋️', label: 'Luyện tập' },
  { to: '/learn', icon: '🎓', label: 'Học' },
  { to: '/pvp', icon: '⚔️', label: 'Chơi online' },
  { to: '/settings', icon: '⚙️', label: 'Cài đặt' },
];

export function Layout() {
  const due = useDueCount(useNow()) ?? 0;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5 hover:text-white'
    }`;

  const items = NAV.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/puzzles'} className={linkClass}>
      <span className="text-lg leading-none">{item.icon}</span>
      <span>{item.label}</span>
      {item.to === '/review' && due > 0 && (
        <span className="ml-auto rounded-full bg-bad px-1.5 text-xs text-white">{due}</span>
      )}
      {item.soon && <span className="ml-auto text-[10px] uppercase text-muted">sắp có</span>}
    </NavLink>
  ));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-1 border-r border-white/5 bg-[#1f1e1b] p-3 lg:flex">
        <Brand />
        {items}
        <div className="mt-auto">
          <SyncStatus />
        </div>
      </aside>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1f1e1b] lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Brand />
          <SyncStatus compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">{items}</nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-6">
        <ErrorBoundary key={location.hash}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="mb-3 flex items-center gap-2 px-2 text-xl font-extrabold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">♞</span>
      <span>
        Cờ Vua <span className="text-accent">Luyện Tập</span>
      </span>
    </NavLink>
  );
}

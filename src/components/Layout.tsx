import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useDueCount } from '../data/store';
import { ErrorBoundary } from './ErrorBoundary';
import { SyncStatus } from './SyncStatus';
import { useNow } from './useNow';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  /** Short label for the phone tab bar. */
  tab?: string;
}

const NAV: NavItem[] = [
  { to: '/', icon: '🏠', label: 'Trang chủ', tab: 'Trang chủ' },
  { to: '/puzzles', icon: '🧩', label: 'Puzzle', tab: 'Puzzle' },
  { to: '/themes', icon: '🎯', label: 'Chủ đề' },
  { to: '/rush', icon: '⚡', label: 'Rush' },
  { to: '/review', icon: '🔁', label: 'Ôn lỗi' },
  { to: '/daily', icon: '📅', label: 'Hằng ngày' },
  { to: '/stats', icon: '📈', label: 'Thống kê' },
  { to: '/train', icon: '🏋️', label: 'Luyện tập', tab: 'Luyện tập' },
  { to: '/learn', icon: '🎓', label: 'Học', tab: 'Học' },
  { to: '/pvp', icon: '⚔️', label: 'Chơi online', tab: 'Online' },
  { to: '/settings', icon: '⚙️', label: 'Cài đặt' },
];

const exact = (to: string) => to === '/' || to === '/puzzles';

export function Layout() {
  const due = useDueCount(useNow()) ?? 0;
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the phone menu after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const badge = (to: string) =>
    to === '/review' && due > 0 ? <span className="rounded-full bg-bad px-1.5 text-xs leading-5 text-white">{due}</span> : null;

  const sideLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r border-white/5 bg-[#1f1e1b] p-3 lg:flex">
        <Brand />
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={exact(item.to)} className={sideLink}>
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {badge(item.to)}
          </NavLink>
        ))}
        <div className="mt-auto">
          <SyncStatus />
        </div>
      </aside>

      {/* Phone/tablet top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-white/5 bg-[#1f1e1b]/95 pr-1 pl-3 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex-1" />
        <SyncStatus compact />
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-stone-200 hover:bg-white/10"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          ☰
          {due > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-bad" />}
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-2 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 lg:p-6 short:pb-4">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Phone tab bar (hidden on short landscape screens, where the ☰ menu is used) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-[#1f1e1b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden short:hidden"
        aria-label="Điều hướng chính"
      >
        {NAV.filter((n) => n.tab).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={exact(item.to)}
            className={({ isActive }) =>
              `flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                isActive ? 'text-white' : 'text-stone-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl leading-none ${isActive ? '' : 'opacity-70 grayscale-[40%]'}`}>{item.icon}</span>
                <span>{item.tab}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Phone menu sheet with every section */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-[#1f1e1b] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <Brand />
              <button className="flex h-10 w-10 items-center justify-center rounded-lg text-xl hover:bg-white/10" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={exact(item.to)}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                      isActive ? 'bg-accent/25 text-white' : 'bg-panel text-stone-200'
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {badge(item.to)}
                </NavLink>
              ))}
            </div>
            <div className="mt-3">
              <SyncStatus />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink
      to="/"
      className={`flex items-center gap-2 font-extrabold ${compact ? 'h-10 text-base' : 'mb-3 px-2 text-xl lg:mb-3'}`}
    >
      <span className={`flex items-center justify-center rounded-lg bg-accent text-white ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}>♞</span>
      <span>
        Cờ Vua <span className="text-accent">Luyện Tập</span>
      </span>
    </NavLink>
  );
}

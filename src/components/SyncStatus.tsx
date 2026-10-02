import { NavLink } from 'react-router';
import { useSyncState } from '../data/sync';
import { useNow } from './useNow';

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

/** Where progress is saved: this browser only, or online (with sync state). */
export function SyncStatus({ compact }: { compact?: boolean }) {
  const s = useSyncState();
  const now = useNow(30_000);
  let icon = '💾';
  let text = 'Lưu trên trình duyệt';
  let sub: string | null = null;
  if (s.config) {
    if (s.status === 'syncing') [icon, text] = ['🔄', 'Đang đồng bộ…'];
    else if (s.status === 'error') [icon, text] = ['⚠️', 'Lỗi đồng bộ'];
    else if (s.dirty) [icon, text] = ['☁️', 'Chờ lưu online…'];
    else {
      [icon, text] = ['☁️', 'Đã lưu online'];
      sub = s.lastSyncAt ? timeAgo(s.lastSyncAt, now) : null;
    }
  }
  return (
    <NavLink
      to="/settings"
      title={s.error ?? text}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-white/5 hover:text-white ${s.status === 'error' ? 'text-warn' : ''}`}
    >
      <span>{icon}</span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate">{text}</span>
          {sub && <span className="block text-[10px] opacity-70">{sub}</span>}
        </span>
      )}
    </NavLink>
  );
}

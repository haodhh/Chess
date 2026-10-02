import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { BoardTheme } from '../data/db';
import { chooseLevelAgain, exportBackup, importBackup, resetAll, updateSettings, useProfile } from '../data/store';

const BOARD_THEMES: { id: BoardTheme; name: string; light: string; dark: string }[] = [
  { id: 'green', name: 'Xanh lá', light: '#ebecd0', dark: '#739552' },
  { id: 'brown', name: 'Gỗ', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', name: 'Xanh dương', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'purple', name: 'Tím', light: '#efe9f7', dark: '#8877b7' },
];

export function SettingsPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!profile) return null;
  const s = profile.settings;

  const download = async () => {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `co-vua-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      await importBackup(await file.text());
      setMessage('Đã khôi phục dữ liệu.');
    } catch (e) {
      setMessage(`Lỗi: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Cài đặt</h1>

      <section className="card">
        <h2 className="mb-3 font-semibold">Bàn cờ</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ boardTheme: t.id })}
              className={`rounded-lg p-2 text-sm ${s.boardTheme === t.id ? 'bg-accent/30 ring-2 ring-accent' : 'bg-panel-2'}`}
            >
              <div
                className="mx-auto mb-1 aspect-square w-16 rounded"
                style={{ background: `repeating-conic-gradient(${t.dark} 0 25%, ${t.light} 0 50%) 0 0 / 50% 50%` }}
              />
              {t.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Toggle label="Hiện tọa độ" checked={s.coordinates} onChange={(v) => updateSettings({ coordinates: v })} />
          <Toggle label="Hiệu ứng di chuyển quân" checked={s.animation} onChange={(v) => updateSettings({ animation: v })} />
          <Toggle label="Âm thanh" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Mục tiêu</h2>
        <label className="flex items-center justify-between gap-3">
          <span>Số puzzle mỗi ngày</span>
          <select
            className="rounded-lg bg-panel-2 px-3 py-2"
            value={s.dailyGoal}
            onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Dữ liệu</h2>
        <p className="mb-3 text-sm text-muted">
          Tiến độ chỉ được lưu trong trình duyệt này. Hãy sao lưu định kỳ, hoặc khi chuyển sang máy khác.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={download}>
            ⬇ Sao lưu
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            ⬆ Khôi phục
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
          />
          <button
            className="btn"
            onClick={async () => {
              if (confirm('Chọn lại trình độ? Rating puzzle sẽ được đặt lại (lịch sử vẫn giữ nguyên).')) {
                await chooseLevelAgain();
                navigate('/');
              }
            }}
          >
            Chọn lại trình độ
          </button>
          <button
            className="btn text-bad"
            onClick={async () => {
              if (confirm('Xóa toàn bộ dữ liệu (rating, lịch sử, ôn tập)? Không thể hoàn tác.')) {
                await resetAll();
                setMessage('Đã xóa dữ liệu.');
              }
            }}
          >
            Xóa toàn bộ dữ liệu
          </button>
        </div>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </section>

      <section className="card text-sm text-muted">
        <h2 className="mb-2 font-semibold text-white">Giới thiệu</h2>
        <p>
          Puzzle lấy từ{' '}
          <a className="link" href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">
            kho puzzle mở của Lichess
          </a>{' '}
          (CC0). Bàn cờ dùng{' '}
          <a className="link" href="https://github.com/lichess-org/chessground" target="_blank" rel="noreferrer">
            chessground
          </a>
          , luật cờ dùng chess.js. Mã nguồn phát hành theo giấy phép GPL-3.0.
        </p>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-[#81b64c]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

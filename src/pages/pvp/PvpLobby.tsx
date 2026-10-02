import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createRoom,
  formatTime,
  getNickname,
  listRooms,
  recentSeats,
  rememberSeat,
  serverAvailable,
  setNickname,
  TIME_CONTROLS,
  type LobbyEntry,
  type TimeControl,
} from '../../pvp/api';
import { PieceIcon } from '../../components/PieceIcon';

const COLOR_LABEL = { white: 'Trắng', black: 'Đen', random: 'Ngẫu nhiên' };

export function PvpLobby() {
  const navigate = useNavigate();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [nickname, setNick] = useState(getNickname);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [time, setTime] = useState<TimeControl | null>(TIME_CONTROLS[4]);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<LobbyEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    serverAvailable().then(setAvailable);
  }, []);

  // Refresh the list of open rooms every few seconds.
  useEffect(() => {
    if (!available) return;
    let stop = false;
    const load = () =>
      listRooms()
        .then((r) => !stop && setRooms(r))
        .catch(() => undefined);
    void load();
    const id = window.setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [available]);

  const updateNick = (v: string) => {
    setNick(v);
    setNickname(v.trim());
  };

  const create = async () => {
    if (!nickname.trim()) {
      setError('Hãy nhập tên của bạn trước.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const seat = await createRoom({ nickname: nickname.trim(), name: name.trim(), password, color, time });
      rememberSeat(seat.code, seat.token, name.trim() || `Phòng của ${nickname.trim()}`);
      navigate(`/pvp/${seat.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (available === null) return <div className="text-muted">Đang kết nối máy chủ…</div>;
  if (!available) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 text-2xl font-extrabold">⚔️ Chơi online</h1>
        <div className="card text-sm text-muted">
          <p className="mb-2">Không kết nối được tới máy chủ chơi online.</p>
          <p>
            Chế độ này chạy trên bản Cloudflare của trang (máy chủ phòng chơi là một Cloudflare Worker). Nếu bạn đang mở bản
            GitHub Pages, hãy mở địa chỉ Cloudflare của trang để chơi với người khác.
          </p>
        </div>
      </div>
    );
  }

  const mine = recentSeats().slice(0, 5);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">⚔️ Chơi online</h1>
        <p className="text-muted">Tạo phòng (có thể đặt mật khẩu), gửi mã phòng cho bạn bè, hoặc vào một phòng đang chờ.</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label htmlFor="nick" className="text-sm text-muted">
          Tên của bạn
        </label>
        <input
          id="nick"
          className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2"
          maxLength={20}
          placeholder="Ví dụ: Hào"
          value={nickname}
          onChange={(e) => updateNick(e.target.value)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card flex flex-col gap-3">
          <h2 className="font-bold">➕ Tạo phòng</h2>
          <input
            className="rounded-lg bg-panel-2 px-3 py-2"
            maxLength={40}
            placeholder="Tên phòng (không bắt buộc)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg bg-panel-2 px-3 py-2"
            maxLength={50}
            type="password"
            autoComplete="new-password"
            placeholder="Mật khẩu phòng (để trống nếu ai cũng vào được)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div>
            <div className="mb-1 text-sm text-muted">Bạn cầm</div>
            <div className="flex flex-wrap gap-2">
              {(['white', 'black', 'random'] as const).map((c) => (
                <button key={c} className={`btn btn-sm py-2 ${color === c ? 'bg-accent text-white' : ''}`} onClick={() => setColor(c)}>
                  {c === 'random' ? <span>🎲</span> : <PieceIcon color={c} />}
                  {COLOR_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm text-muted">Thời gian (phút + giây cộng thêm mỗi nước)</div>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={formatTime(t)}
                  className={`btn btn-sm py-2 ${formatTime(time) === formatTime(t) ? 'bg-accent text-white' : ''}`}
                  onClick={() => setTime(t)}
                >
                  {t ? formatTime(t) : '∞'}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? 'Đang tạo…' : 'Tạo phòng'}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </section>

        <section className="flex flex-col gap-5">
          <form
            className="card flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/pvp/${code.trim().toUpperCase()}`);
            }}
          >
            <h2 className="font-bold">🔑 Vào phòng bằng mã</h2>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2 font-mono uppercase tracking-widest"
                maxLength={6}
                placeholder="MÃ PHÒNG"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              />
              <button className="btn" disabled={code.trim().length !== 6}>
                Vào
              </button>
            </div>
          </form>

          <div className="card">
            <h2 className="mb-3 font-bold">🚪 Phòng đang chờ đối thủ</h2>
            {rooms === null && <p className="text-sm text-muted">Đang tải…</p>}
            {rooms?.length === 0 && <p className="text-sm text-muted">Chưa có phòng nào. Hãy tạo một phòng!</p>}
            <div className="flex flex-col divide-y divide-white/5">
              {rooms?.map((r) => (
                <div key={r.code} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-lg">{r.hasPassword ? '🔒' : '🟢'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="text-xs text-muted">
                      {r.host} · {formatTime(r.time)} · chủ phòng cầm {COLOR_LABEL[r.hostColor]}
                    </div>
                  </div>
                  <Link className="btn btn-sm py-2" to={`/pvp/${r.code}`}>
                    Vào
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {mine.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-bold">🕘 Phòng bạn đã vào</h2>
              <div className="flex flex-wrap gap-2">
                {mine.map((s) => (
                  <Link key={s.code} className="btn btn-sm py-2" to={`/pvp/${s.code}`}>
                    <span className="font-mono">{s.code}</span> {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

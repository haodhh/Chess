import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { gameFromPgn, importChessCom, importLichess } from '../../data/importGames';
import { deleteGame, saveGame, useGames } from '../../data/train';

const SOURCE_LABEL = { bot: '🤖 Với máy', pgn: '📄 PGN', chesscom: '♟ chess.com', lichess: '🐴 Lichess' };

type Tab = 'chesscom' | 'lichess' | 'pgn';

export function Games() {
  const games = useGames();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('chesscom');
  const [username, setUsername] = useState(() => localStorageGet('import-username') ?? '');
  const [pgn, setPgn] = useState('');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await fn() });
    } catch (e) {
      const text = e instanceof TypeError ? 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.' : e instanceof Error ? e.message : String(e);
      setMessage({ text, error: true });
    } finally {
      setBusy(false);
    }
  };

  const importOnline = () =>
    run(async () => {
      localStorageSet('import-username', username.trim());
      const n = tab === 'chesscom' ? await importChessCom(username) : await importLichess(username);
      return n > 0 ? `Đã nhập ${n} ván mới.` : 'Không có ván mới nào.';
    });

  const importPgn = () =>
    run(async () => {
      let game;
      try {
        game = gameFromPgn(pgn, color);
      } catch {
        throw new Error('Không đọc được PGN này.');
      }
      const id = await saveGame(game);
      setPgn('');
      navigate(`/train/review/${id}`);
      return 'Đã thêm ván.';
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">📚 Ván cờ của bạn</h1>
        <p className="text-muted">Nhập ván từ chess.com, Lichess hoặc PGN, rồi để Stockfish tìm ra chỗ bạn đi sai.</p>
      </div>

      <section className="card">
        <div className="mb-3 flex gap-2">
          {(['chesscom', 'lichess', 'pgn'] as const).map((t) => (
            <button key={t} className={`btn btn-sm py-2 ${tab === t ? 'bg-accent text-white' : ''}`} onClick={() => setTab(t)}>
              {t === 'chesscom' ? 'chess.com' : t === 'lichess' ? 'Lichess' : 'Dán PGN'}
            </button>
          ))}
        </div>
        {tab === 'pgn' ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="h-32 rounded-lg bg-panel-2 p-2 font-mono text-xs"
              placeholder='[Event "..."]&#10;1. e4 e5 2. Nf3 ...'
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Bạn cầm:</span>
              {(['white', 'black'] as const).map((c) => (
                <button key={c} className={`btn btn-sm ${color === c ? 'bg-accent text-white' : ''}`} onClick={() => setColor(c)}>
                  {c === 'white' ? 'Trắng' : 'Đen'}
                </button>
              ))}
              <button className="btn btn-primary ml-auto" disabled={busy || !pgn.trim()} onClick={importPgn}>
                Thêm & phân tích
              </button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void importOnline();
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2"
              placeholder={`Tên người dùng ${tab === 'chesscom' ? 'chess.com' : 'Lichess'}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy || !username.trim()}>
              {busy ? 'Đang tải…' : 'Nhập 20 ván gần nhất'}
            </button>
          </form>
        )}
        {message && <p className={`mt-3 text-sm ${message.error ? 'text-bad' : 'text-good'}`}>{message.text}</p>}
      </section>

      <section className="card">
        <div className="mb-3 font-semibold">Danh sách ván ({games?.length ?? 0})</div>
        {games?.length === 0 && (
          <p className="text-sm text-muted">
            Chưa có ván nào. Hãy <Link className="link" to="/train/play">chơi với máy</Link> hoặc nhập ván ở trên.
          </p>
        )}
        <div className="divide-y divide-white/5">
          {games?.map((g) => {
            const acc = g.analysis?.accuracy[g.userColor];
            const won = (g.result === '1-0' && g.userColor === 'white') || (g.result === '0-1' && g.userColor === 'black');
            const lost = (g.result === '0-1' && g.userColor === 'white') || (g.result === '1-0' && g.userColor === 'black');
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={`w-2 self-stretch rounded ${won ? 'bg-good' : lost ? 'bg-bad' : 'bg-white/20'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <b>{g.white}</b> – <b>{g.black}</b> <span className="text-muted">{g.result}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {SOURCE_LABEL[g.source]} · {new Date(g.ts).toLocaleDateString('vi-VN')}
                    {acc !== undefined && ` · độ chính xác ${acc.toFixed(1)}`}
                  </div>
                </div>
                <Link className="btn btn-sm py-2" to={`/train/review/${g.id}`}>
                  {g.analysis ? 'Xem phân tích' : 'Phân tích'}
                </Link>
                <button className="btn btn-sm py-2" aria-label="Xóa ván" onClick={() => confirm('Xóa ván này?') && deleteGame(g.id!)}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function localStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembering the username is only a convenience.
  }
}

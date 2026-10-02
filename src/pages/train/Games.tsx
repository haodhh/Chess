import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { gameFromPgn } from '../../data/importGames';
import { deleteGame, saveGame, useGames } from '../../data/train';

const SOURCE_LABEL: Record<string, string> = { bot: '🤖 Với máy', pgn: '📄 PGN', pvp: '⚔️ Online' };

export function Games() {
  const games = useGames();
  const navigate = useNavigate();
  const [showPgn, setShowPgn] = useState(false);
  const [pgn, setPgn] = useState('');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [error, setError] = useState<string | null>(null);

  const importPgn = async () => {
    setError(null);
    let game;
    try {
      game = gameFromPgn(pgn, color);
    } catch {
      setError('Không đọc được PGN này.');
      return;
    }
    const id = await saveGame(game);
    setPgn('');
    navigate(`/train/review/${id}`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">📚 Ván cờ của bạn</h1>
        <p className="text-muted">Các ván bạn chơi với máy được lưu tại đây. Mở một ván để Stockfish tìm ra chỗ bạn đi sai.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/train/play" className="btn btn-primary">
          🤖 Chơi ván mới
        </Link>
        <button className="btn" onClick={() => setShowPgn((v) => !v)}>
          📄 Thêm ván từ PGN
        </button>
      </div>

      {showPgn && (
        <section className="card flex flex-col gap-2">
          <p className="text-sm text-muted">Dán ván cờ dạng PGN (ví dụ ván bạn chơi ngoài đời và ghi lại) để phân tích.</p>
          <textarea
            className="h-32 rounded-lg bg-panel-2 p-2 font-mono text-xs"
            placeholder="1. e4 e5 2. Nf3 Nc6 ..."
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
            <button className="btn btn-primary ml-auto" disabled={!pgn.trim()} onClick={importPgn}>
              Thêm & phân tích
            </button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </section>
      )}

      <section className="card">
        <div className="mb-3 font-semibold">Danh sách ván ({games?.length ?? 0})</div>
        {games?.length === 0 && (
          <p className="text-sm text-muted">
            Chưa có ván nào. Hãy <Link className="link" to="/train/play">chơi với máy</Link>.
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
                    {SOURCE_LABEL[g.source] ?? '📄'} · {new Date(g.ts).toLocaleDateString('vi-VN')}
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

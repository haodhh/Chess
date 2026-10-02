import { useEffect, useState } from 'react';
import { timeAgo } from '../components/SyncStatus';
import { useNow } from '../components/useNow';
import { requestPersistentStorage } from '../data/store';
import { connect, disconnect, setAutoSync, syncNow, useSyncState } from '../data/sync';

const TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=' + encodeURIComponent('Cờ Vua Luyện Tập');

/** Where data is saved: always in this browser, optionally online in a private GitHub Gist. */
export function SyncSettings() {
  const s = useSyncState();
  const now = useNow(30_000);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false));
  }, []);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect(token);
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="mb-1 font-semibold">💾 Lưu trên trình duyệt</h2>
        <p className="text-sm text-muted">
          Mọi tiến độ (rating, puzzle, ván cờ, bài học…) được <b className="text-white">tự động lưu</b> ngay trong trình duyệt
          này sau mỗi nước đi.{' '}
          {persisted ? (
            <span className="text-good">Trình duyệt đã cho phép lưu bền vững ✓</span>
          ) : (
            <>
              Dữ liệu có thể mất nếu bạn xóa dữ liệu duyệt web.{' '}
              <button className="link" onClick={async () => setPersisted(await requestPersistentStorage())}>
                Yêu cầu lưu bền vững
              </button>
              {persisted === false && ' (trình duyệt có thể từ chối)'}
            </>
          )}
        </p>
      </div>

      <div>
        <h2 className="mb-1 font-semibold">☁️ Lưu online</h2>
        {s.config ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted">
              Đã kết nối với GitHub <b className="text-white">@{s.config.login}</b>. Dữ liệu được lưu trong một Gist bí mật của
              bạn. Mở trang này trên máy khác và kết nối cùng tài khoản để chơi tiếp.
            </p>
            <div className={s.status === 'error' ? 'text-warn' : 'text-muted'}>
              {s.status === 'syncing'
                ? '🔄 Đang đồng bộ…'
                : s.status === 'error'
                  ? `⚠️ ${s.error}`
                  : s.lastSyncAt
                    ? `✓ Đồng bộ lần cuối ${timeAgo(s.lastSyncAt, now)}${s.dirty ? ' · có thay đổi chờ lưu' : ''}`
                    : 'Chưa đồng bộ lần nào.'}
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>Tự động đồng bộ khi có thay đổi</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#81b64c]"
                checked={s.config.auto}
                onChange={(e) => setAutoSync(e.target.checked)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={s.status === 'syncing'} onClick={() => void syncNow()}>
                🔄 Đồng bộ ngay
              </button>
              <a className="btn" href={s.config.gistUrl} target="_blank" rel="noreferrer">
                Xem trên GitHub ↗
              </a>
              <button
                className="btn"
                onClick={() =>
                  confirm('Ngắt kết nối? Dữ liệu vẫn còn trong trình duyệt và trên GitHub, chỉ dừng đồng bộ.') && disconnect()
                }
              >
                Ngắt kết nối
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted">
              Lưu thêm một bản online để không lo mất dữ liệu và chơi tiếp trên máy khác. Dữ liệu được lưu vào một{' '}
              <b className="text-white">Gist bí mật</b> trong tài khoản GitHub của bạn: miễn phí, chỉ bạn xem được.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>
                <a className="link" href={TOKEN_URL} target="_blank" rel="noreferrer">
                  Tạo token GitHub ↗
                </a>{' '}
                (đã chọn sẵn quyền duy nhất cần thiết là <b className="text-white">gist</b>). Ở mục Expiration có thể chọn
                "No expiration" để khỏi phải tạo lại.
              </li>
              <li>Bấm "Generate token", copy token rồi dán vào ô dưới đây.</li>
            </ol>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onConnect();
              }}
            >
              <input
                type="password"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2 font-mono"
                placeholder="ghp_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button className="btn btn-primary" disabled={busy || !token.trim()}>
                {busy ? 'Đang kết nối…' : 'Kết nối'}
              </button>
            </form>
            {error && <p className="text-bad">{error}</p>}
            <p className="text-xs text-muted">
              Token chỉ được lưu trong trình duyệt này, không nằm trong bản sao lưu hay trên Gist. Hãy dùng token chỉ có quyền
              gist.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

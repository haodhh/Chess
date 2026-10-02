import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Chess } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { MoveTable } from '../../components/MoveTable';
import { colorOf, isPromotionMove, legalDests, parseUci, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { useProfile } from '../../data/store';
import { saveGame } from '../../data/train';
import { formatTime, getNickname, joinRoom, rememberSeat, roomInfo, savedSeat, setNickname, type RoomView } from '../../pvp/api';
import { useRoom } from '../../pvp/useRoom';

type Side = 'white' | 'black';
const ABANDON_MS = 60_000;
const other = (c: Side): Side => (c === 'white' ? 'black' : 'white');

export function PvpRoom() {
  const { code = '' } = useParams();
  const upper = code.toUpperCase();
  const [token, setToken] = useState(() => savedSeat(upper)?.token ?? null);
  if (!token) return <JoinRoom code={upper} onJoined={setToken} />;
  return <RoomGame key={token} code={upper} token={token} />;
}

function JoinRoom({ code, onJoined }: { code: string; onJoined: (token: string) => void }) {
  const [info, setInfo] = useState<(RoomView & { seatsFree: boolean }) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nickname, setNick] = useState(getNickname);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    roomInfo(code).then(setInfo, (e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [code]);

  const join = async () => {
    if (!nickname.trim()) return setError('Hãy nhập tên của bạn.');
    setBusy(true);
    setError(null);
    try {
      setNickname(nickname.trim());
      const seat = await joinRoom(code, nickname.trim(), password);
      rememberSeat(code, seat.token, info?.name ?? code);
      onJoined(seat.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Link to="/pvp" className="back-link mb-1">
        ← Sảnh chơi online
      </Link>
      <div className="card flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">Vào phòng {code}</h1>
        {loadError && <p className="text-bad">{loadError}</p>}
        {!info && !loadError && <p className="text-muted">Đang tải thông tin phòng…</p>}
        {info && !info.seatsFree && <p className="text-bad">Phòng đã đủ 2 người.</p>}
        {info && info.seatsFree && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <div className="text-sm text-muted">
              <b className="text-white">{info.name}</b> · chủ phòng {info.players.white?.nickname ?? info.players.black?.nickname} ·{' '}
              {formatTime(info.time)}
            </div>
            <input
              className="rounded-lg bg-panel-2 px-3 py-2"
              maxLength={20}
              placeholder="Tên của bạn"
              value={nickname}
              onChange={(e) => setNick(e.target.value)}
            />
            {info.hasPassword && (
              <input
                className="rounded-lg bg-panel-2 px-3 py-2"
                type="password"
                autoComplete="off"
                placeholder="🔒 Mật khẩu phòng"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang vào…' : 'Vào phòng'}
            </button>
            {error && <p className="text-sm text-bad">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  if (t < 10_000) return `${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A clock that keeps counting down locally between server updates. */
function Clock({ ms, running, serverNow, offset }: { ms: number; running: boolean; serverNow: number; offset: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [running]);
  const left = running ? ms - (Date.now() + offset - serverNow) : ms;
  return (
    <span
      className={`rounded-md px-2 py-1 font-mono text-xl font-bold tabular-nums ${
        running ? 'bg-stone-100 text-stone-900' : 'bg-black/30 text-stone-300'
      } ${left < 20_000 && running ? '!bg-bad !text-white' : ''}`}
    >
      {formatClock(left)}
    </span>
  );
}

function RoomGame({ code, token }: { code: string; token: string }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const { room, you, online, offset, error, send } = useRoom(code, token);
  // A move shown before the server confirms it; `base` is how many moves the game had then.
  const [pending, setPending] = useState<{ uci: string; base: number } | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [savedIds, setSavedIds] = useState<Record<number, number>>({});
  const lastMoves = useRef(0);
  const [, tick] = useState(0);

  // Server state replaces any move we showed before it was confirmed.
  useEffect(() => {
    setPending(null);
    setSyncKey((k) => k + 1);
  }, [room]);

  // Sounds for new moves and the end of the game.
  useEffect(() => {
    if (!room) return;
    if (room.moves.length > lastMoves.current && lastMoves.current > 0) {
      const c = new Chess();
      let captured = false;
      for (const m of room.moves) captured = !!c.move(parseUci(m)).captured;
      playSound(captured ? 'capture' : 'move');
    }
    lastMoves.current = room.moves.length;
  }, [room?.moves.length, room]);

  // Save each finished game once so it can be analysed later.
  const savedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!room || !you || room.status !== 'finished' || room.moves.length < 2) return;
    const key = `${code}-${room.game}`;
    const stored = localStorage.getItem(`pvp-saved-${key}`);
    if (stored) {
      setSavedIds((s) => (s[room.game] ? s : { ...s, [room.game]: Number(stored) }));
      return;
    }
    if (savedRef.current.has(key)) return;
    savedRef.current.add(key);
    playSound(room.result?.winner === you ? 'success' : room.result?.winner ? 'error' : 'move');
    const c = new Chess();
    for (const m of room.moves) c.move(parseUci(m));
    const result = room.result?.winner === 'white' ? '1-0' : room.result?.winner === 'black' ? '0-1' : '1/2-1/2';
    c.setHeader('Event', `Chơi online · phòng ${code}`);
    c.setHeader('White', room.players.white?.nickname ?? 'Trắng');
    c.setHeader('Black', room.players.black?.nickname ?? 'Đen');
    c.setHeader('Result', result);
    void saveGame({
      ts: Date.now(),
      source: 'pvp',
      pgn: c.pgn(),
      white: room.players.white?.nickname ?? 'Trắng',
      black: room.players.black?.nickname ?? 'Đen',
      result,
      userColor: you,
    }).then((id) => {
      setSavedIds((s) => ({ ...s, [room.game]: id }));
      try {
        localStorage.setItem(`pvp-saved-${key}`, String(id));
      } catch {
        // Only prevents saving twice after a reload.
      }
    });
  }, [room, you, code]);

  // Re-render every second so "opponent left" timers update.
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const showPending = !!room && !!pending && room.moves.length === pending.base;
  const moves = useMemo(
    () => (room ? [...room.moves, ...(showPending && pending ? [pending.uci] : [])] : []),
    [room, pending, showPending],
  );
  const chess = useMemo(() => {
    const c = new Chess();
    for (const m of moves) {
      try {
        c.move(parseUci(m));
      } catch {
        break;
      }
    }
    return c;
  }, [moves]);
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);
  const turn = colorOf(chess.turn());
  const myTurn = !!room && room.status === 'playing' && you === turn && !showPending;
  const dests = useMemo(() => (myTurn ? legalDests(chess) : new Map()), [chess, myTurn]);

  if (!profile) return null;
  if (!room || !you) {
    return (
      <div className="card">
        {error ?? (online ? 'Đang tải phòng…' : 'Đang kết nối tới phòng…')}{' '}
        <Link className="link" to="/pvp">
          Về sảnh
        </Link>
      </div>
    );
  }

  const opp = other(you);
  const oppAway = room.players[opp]?.awaySince;
  const canClaim = room.status === 'playing' && oppAway !== null && oppAway !== undefined && Date.now() + offset - oppAway >= ABANDON_MS;
  const inviteUrl = `${location.origin}${location.pathname}#/pvp/${code}`;

  const playerBar = (side: Side) => {
    const p = room.players[side];
    const running = room.status === 'playing' && room.clockRunning && turn === side && !showPending;
    return (
      <div className="flex items-center gap-2 rounded-lg bg-panel px-3 py-2">
        <span className={`h-3 w-3 rounded-full border border-black/40 ${side === 'white' ? 'bg-stone-100' : 'bg-stone-900'}`} />
        <span className="flex-1 truncate font-semibold">
          {p?.nickname ?? 'Đang chờ…'} {side === you && <span className="text-xs text-muted">(bạn)</span>}
        </span>
        {p && (
          <span className={`text-xs ${p.connected ? 'text-good' : 'text-muted'}`} title={p.connected ? 'Đang kết nối' : 'Mất kết nối'}>
            {p.connected ? '● online' : '○ offline'}
          </span>
        )}
        {room.clock && <Clock ms={room.clock[side]} running={running} serverNow={room.serverNow} offset={offset} />}
      </div>
    );
  };

  const resultText =
    room.result &&
    (room.result.winner === null ? 'Hòa' : room.result.winner === you ? 'Bạn thắng! 🎉' : 'Bạn thua');

  return (
    <div className="game-layout">
      <div className="board-col board-col-bars flex flex-col gap-2">
        <div className="short:hidden">{playerBar(opp)}</div>
        <Board
          fen={chess.fen()}
          orientation={you}
          turnColor={turn}
          movable={myTurn ? you : undefined}
          dests={dests}
          lastMove={lastMove}
          check={chess.inCheck()}
          coordinates={profile.settings.coordinates}
          animation={profile.settings.animation}
          theme={profile.settings.boardTheme}
          syncKey={syncKey}
          isPromotion={(o, d) => isPromotionMove(chess, o, d)}
          onMove={(o, d, p) => {
            const uci = toUci(o, d, p);
            setPending({ uci, base: room.moves.length });
            playSound('move');
            send({ t: 'move', uci, game: room.game });
          }}
        />
        <div className="short:hidden">{playerBar(you)}</div>
      </div>

      <aside className="flex flex-col gap-3">
        {/* Sideways phones: the board fills the height, so the clocks move here. */}
        <div className="-order-2 hidden flex-col gap-2 short:flex">
          {playerBar(opp)}
          {playerBar(you)}
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{room.name}</div>
              <div className="text-xs text-muted">
                Mã phòng <b className="font-mono text-white">{code}</b> · {formatTime(room.time)}
                {room.hasPassword && ' · 🔒'}
              </div>
            </div>
            <span className={`text-xs ${online ? 'text-good' : 'text-warn'}`}>{online ? '● đã kết nối' : '○ đang kết nối lại…'}</span>
          </div>
        </div>

        {room.status === 'waiting' && (
          <div className="card -order-1 flex flex-col gap-2 border border-accent/50 lg:order-none">
            <div className="text-lg font-bold">⏳ Đang chờ đối thủ…</div>
            <p className="text-sm text-muted">
              Gửi cho bạn bè mã phòng <b className="font-mono text-white">{code}</b>
              {room.hasPassword && ' kèm mật khẩu'} hoặc đường link dưới đây.
            </p>
            <div className="flex gap-2">
              <input readOnly className="min-w-0 flex-1 rounded-lg bg-panel-2 px-2 py-1 font-mono text-xs" value={inviteUrl} />
              <button
                className="btn btn-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteUrl);
                  setCopied(true);
                }}
              >
                {copied ? 'Đã copy' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="card -order-1 text-sm text-warn lg:order-none">{error}</div>}

        {room.status === 'playing' && (
          <div className="card -order-1 text-sm lg:order-none">
            {myTurn ? <b className="text-good">Đến lượt bạn</b> : <span className="text-muted">Đối thủ đang nghĩ…</span>}
            {room.drawOffer === opp && (
              <div className="mt-3 rounded-lg bg-white/5 p-2">
                🤝 Đối thủ đề nghị hòa.
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="btn btn-sm py-2" onClick={() => send({ t: 'draw' })}>
                    Đồng ý hòa
                  </button>
                  <button className="btn btn-sm py-2" onClick={() => send({ t: 'decline-draw' })}>
                    Từ chối
                  </button>
                </div>
              </div>
            )}
            {room.drawOffer === you && <div className="mt-2 text-muted">Đã gửi lời đề nghị hòa.</div>}
            {oppAway && !canClaim && <div className="mt-2 text-warn">Đối thủ mất kết nối…</div>}
            {canClaim && (
              <button className="btn btn-primary mt-3 w-full" onClick={() => send({ t: 'claim' })}>
                Đối thủ đã rời: nhận thắng
              </button>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-sm py-2" disabled={room.drawOffer !== null} onClick={() => send({ t: 'draw' })}>
                🤝 Cầu hòa
              </button>
              <button
                className="btn btn-sm py-2 text-bad"
                onClick={() => confirm('Xin thua ván này?') && send({ t: 'resign' })}
              >
                🏳 Xin thua
              </button>
            </div>
          </div>
        )}

        {room.status === 'finished' && room.result && (
          <div className={`card -order-1 text-center lg:order-none ${room.result.winner === you ? 'bg-good/20' : room.result.winner ? 'bg-bad/20' : ''}`}>
            <div className="text-2xl font-extrabold">{resultText}</div>
            <div className="text-sm text-muted">{room.result.reason}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-primary" disabled={!!room.rematch[you]} onClick={() => send({ t: 'rematch' })}>
                {room.rematch[you] ? 'Chờ đối thủ…' : room.rematch[opp] ? 'Đồng ý chơi lại' : 'Chơi lại'}
              </button>
              <button
                className="btn"
                disabled={!savedIds[room.game]}
                onClick={() => navigate(`/train/review/${savedIds[room.game]}`)}
              >
                Phân tích ván
              </button>
            </div>
            {room.rematch[opp] && !room.rematch[you] && <div className="mt-2 text-sm text-good">Đối thủ muốn chơi lại (đổi màu quân).</div>}
          </div>
        )}

        <MoveTable moves={history.map((m) => ({ san: m.san }))} current={history.length - 1} />
        <Link to="/pvp" className="back-link">
          ← Sảnh chơi online
        </Link>
      </aside>
    </div>
  );
}

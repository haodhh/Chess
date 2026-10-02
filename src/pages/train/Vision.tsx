import { useEffect, useRef, useState } from 'react';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { playSound } from '../../core/sound';
import { saveVisionRun, useVisionBest } from '../../data/train';
import { useProfile } from '../../data/store';

type Mode = 'find' | 'name';
const DURATION = 30_000;
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const FILES = 'abcdefgh';

const randomSquare = (avoid?: string): Key => {
  let sq: string;
  do sq = FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
  while (sq === avoid);
  return sq as Key;
};

function nameOptions(target: Key): Key[] {
  const set = new Set<Key>([target]);
  while (set.size < 4) set.add(randomSquare());
  return [...set].sort(() => Math.random() - 0.5);
}

export function Vision() {
  const profile = useProfile();
  const best = useVisionBest();
  const [mode, setMode] = useState<Mode>('find');
  const [colorChoice, setColorChoice] = useState<Color | 'random'>('white');
  const [color, setColor] = useState<Color>('white');
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [target, setTarget] = useState<Key>('e4');
  const [options, setOptions] = useState<Key[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<Map<Key, string>>(new Map());
  const [finished, setFinished] = useState<number | null>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        setRunning(false);
        setFinished(scoreRef.current);
        void saveVisionRun({ mode, color, score: scoreRef.current, ts: t });
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, endsAt, mode, color]);

  const next = (prev?: Key) => {
    const t = randomSquare(prev);
    setTarget(t);
    setOptions(nameOptions(t));
  };

  const start = () => {
    const c = colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
    setColor(c);
    scoreRef.current = 0;
    setScore(0);
    setMistakes(0);
    setFinished(null);
    setFlash(new Map());
    next();
    const t = Date.now();
    setNow(t);
    setEndsAt(t + DURATION);
    setRunning(true);
  };

  const answer = (sq: Key) => {
    if (!running) return;
    const ok = sq === target;
    if (ok) {
      scoreRef.current++;
      setScore(scoreRef.current);
      playSound('move');
    } else {
      setMistakes((m) => m + 1);
      playSound('error');
    }
    setFlash(new Map([[sq, ok ? 'vision-ok' : 'vision-bad']]));
    window.setTimeout(() => setFlash(new Map()), 250);
    next(target);
  };

  if (!profile) return null;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const highlights = new Map(flash);
  if (running && mode === 'name') highlights.set(target, 'vision-target');
  const bestKey = `${mode}-${colorChoice === 'random' ? color : colorChoice}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-150px))]">
        <div className="relative">
          <Board
            fen={EMPTY}
            orientation={color}
            turnColor="white"
            coordinates={false}
            theme={profile.settings.boardTheme}
            highlights={highlights}
            onSelect={(k) => mode === 'find' && answer(k)}
          />
          {running && mode === 'find' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[min(22vw,180px)] font-extrabold text-white/80 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                {target}
              </span>
            </div>
          )}
        </div>
      </div>
      <aside className="flex flex-col gap-3">
        <div className="card">
          <h1 className="text-lg font-bold">🎯 Luyện tọa độ</h1>
          <p className="text-sm text-muted">
            Nhận diện tọa độ ô thật nhanh giúp bạn đọc sách, ghi biên bản và tính toán biến dễ hơn.
          </p>
        </div>
        {running ? (
          <div className="card">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-muted">Điểm</div>
                <div className="text-5xl font-extrabold">{score}</div>
              </div>
              <div className={`font-mono text-4xl font-bold ${left <= 5 ? 'text-bad' : ''}`}>{left}s</div>
            </div>
            {mode === 'name' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {options.map((o) => (
                  <button key={o} className="btn py-4 text-2xl" onClick={() => answer(o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
            {mode === 'find' && <p className="mt-3 text-sm text-muted">Bấm vào ô {target} trên bàn cờ.</p>}
            <p className="mt-2 text-xs text-muted">Sai: {mistakes}</p>
          </div>
        ) : (
          <div className="card flex flex-col gap-3">
            {finished !== null && (
              <div className="rounded-lg bg-good/20 p-3 text-center">
                <div className="text-sm text-muted">Kết quả</div>
                <div className="text-4xl font-extrabold">{finished}</div>
                <div className="text-xs text-muted">Sai {mistakes} lần</div>
              </div>
            )}
            <div>
              <div className="mb-1 text-sm text-muted">Kiểu luyện</div>
              <div className="grid grid-cols-2 gap-2">
                <button className={`btn btn-sm py-2 ${mode === 'find' ? 'bg-accent text-white' : ''}`} onClick={() => setMode('find')}>
                  Tìm ô
                </button>
                <button className={`btn btn-sm py-2 ${mode === 'name' ? 'bg-accent text-white' : ''}`} onClick={() => setMode('name')}>
                  Gọi tên ô
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-muted">Cầm quân</div>
              <div className="grid grid-cols-3 gap-2">
                {(['white', 'black', 'random'] as const).map((c) => (
                  <button
                    key={c}
                    className={`btn btn-sm py-2 ${colorChoice === c ? 'bg-accent text-white' : ''}`}
                    onClick={() => {
                      setColorChoice(c);
                      if (c !== 'random') setColor(c);
                    }}
                  >
                    {c === 'white' ? 'Trắng' : c === 'black' ? 'Đen' : 'Ngẫu nhiên'}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted">
              Kỷ lục: <b className="text-white">{best?.[bestKey] ?? 0}</b> ô / 30 giây
            </div>
            <button className="btn btn-primary text-lg" onClick={start}>
              Bắt đầu (30 giây)
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

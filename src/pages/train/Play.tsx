import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Color, Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { MoveTable } from '../../components/MoveTable';
import { isPromotionMove, legalDests, parseUci, toUci } from '../../core/chess';
import { playSound } from '../../core/sound';
import { BOT_LEVELS, type BotLevel } from '../../engine/bot';
import { getEngine } from '../../engine/engine';
import { useEngineGame } from '../../engine/useEngineGame';
import { useProfile } from '../../data/store';
import { clearOngoingBotGame, saveGame, saveOngoingBotGame, useOngoingBotGame } from '../../data/train';

interface Setup {
  level: BotLevel;
  color: Color;
  key: number;
  moves?: string[];
}

export function Play() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [level, setLevel] = useState(BOT_LEVELS[2]);
  const [colorChoice, setColorChoice] = useState<Color | 'random'>('white');
  const ongoing = useOngoingBotGame();
  const ongoingLevel = ongoing ? BOT_LEVELS.find((b) => b.id === ongoing.levelId) : undefined;

  if (setup) {
    return (
      <BotGame
        key={setup.key}
        level={setup.level}
        userColor={setup.color}
        initialMoves={setup.moves}
        onNew={() => setSetup(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-extrabold">🤖 Chơi với máy</h1>
      <p className="mb-5 text-muted">Chọn đối thủ phù hợp. Sau ván đấu, hãy phân tích để tìm ra sai lầm của mình.</p>
      {ongoing && ongoingLevel && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 border border-accent/60">
          <span className="text-3xl">{ongoingLevel.avatar}</span>
          <div className="flex-1">
            <div className="font-bold">Ván đang chơi dở với {ongoingLevel.name}</div>
            <div className="text-sm text-muted">
              Bạn cầm {ongoing.userColor === 'white' ? 'Trắng' : 'Đen'} · đã đi {Math.ceil(ongoing.moves.length / 2)} nước
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setSetup({ level: ongoingLevel, color: ongoing.userColor, moves: ongoing.moves, key: Date.now() })}
          >
            Tiếp tục ván
          </button>
          <button className="btn" onClick={() => confirm('Bỏ ván đang chơi dở?') && clearOngoingBotGame()}>
            Bỏ ván
          </button>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {BOT_LEVELS.map((b) => (
          <button
            key={b.id}
            onClick={() => setLevel(b)}
            className={`card flex items-center gap-3 text-left transition-colors ${level.id === b.id ? 'ring-2 ring-accent' : 'hover:bg-panel-2'}`}
          >
            <span className="text-4xl">{b.avatar}</span>
            <span className="flex-1">
              <span className="font-bold">{b.name}</span> <span className="text-accent">{b.id === 'max' ? 'Tối đa' : b.elo}</span>
              <span className="block text-sm text-muted">{b.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="card mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Bạn cầm:</span>
        {(['white', 'black', 'random'] as const).map((c) => (
          <button key={c} className={`btn btn-sm py-2 ${colorChoice === c ? 'bg-accent text-white' : ''}`} onClick={() => setColorChoice(c)}>
            {c === 'white' ? '♔ Trắng' : c === 'black' ? '♚ Đen' : '🎲 Ngẫu nhiên'}
          </button>
        ))}
        <button
          className="btn btn-primary ml-auto"
          onClick={() => {
            const color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
            setSetup({ level, color, key: Date.now() });
          }}
        >
          Bắt đầu ván
        </button>
      </div>
    </div>
  );
}

function BotGame({
  level,
  userColor,
  initialMoves,
  onNew,
}: {
  level: BotLevel;
  userColor: Color;
  initialMoves?: string[];
  onNew: () => void;
}) {
  const profile = useProfile();
  const navigate = useNavigate();
  const { chess, moves, over, thinking, turn, userMove, takeback, resign } = useEngineGame({ userColor, level, initialMoves });

  // Keep the game in progress saved so it can be resumed later (also on another device when synced).
  useEffect(() => {
    if (over) void clearOngoingBotGame();
    else
      void saveOngoingBotGame({ levelId: level.id, userColor, moves: moves.map((m) => m.from + m.to + (m.promotion ?? '')) });
  }, [moves, over, level.id, userColor]);
  const [orientation, setOrientation] = useState<Color>(userColor);
  const [syncKey, setSyncKey] = useState(0);
  const [hint, setHint] = useState<DrawShape[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const saving = useRef(false);

  const fen = chess.fen();
  const dests = useMemo(() => (turn === userColor && !over ? legalDests(chess) : new Map()), [fen, turn, userColor, over, chess]);
  const last = moves[moves.length - 1];
  const lastMove = useMemo<[Key, Key] | undefined>(() => (last ? [last.from, last.to] : undefined), [last]);

  useEffect(() => setHint([]), [moves.length]);

  // Save finished games once, so they can be reviewed later.
  useEffect(() => {
    if (!over || moves.length < 2 || saving.current) return;
    saving.current = true;
    chess.setHeader('Event', 'Ván với máy');
    chess.setHeader('White', userColor === 'white' ? 'Bạn' : `${level.name} (${level.elo})`);
    chess.setHeader('Black', userColor === 'black' ? 'Bạn' : `${level.name} (${level.elo})`);
    const result = over.winner === 'white' ? '1-0' : over.winner === 'black' ? '0-1' : '1/2-1/2';
    chess.setHeader('Result', result);
    chess.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
    void saveGame({
      ts: Date.now(),
      source: 'bot',
      pgn: chess.pgn(),
      white: chess.getHeaders().White,
      black: chess.getHeaders().Black,
      result,
      userColor,
    }).then(setSavedId);
    playSound(over.winner === userColor ? 'success' : 'error');
  }, [over, moves.length, chess, userColor, level]);

  const showHint = async () => {
    const r = await getEngine().analyse(chess.fen(), { depth: 14 });
    if (r.bestMove) {
      const { from, to } = parseUci(r.bestMove);
      setHint([{ orig: from, dest: to, brush: 'blue' }]);
    }
  };

  if (!profile) return null;
  const outcome = over && (over.winner === null ? 'Hòa' : over.winner === userColor ? 'Bạn thắng! 🎉' : 'Bạn thua');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-150px))]">
        <Board
          fen={fen}
          orientation={orientation}
          turnColor={turn}
          movable={turn === userColor && !over ? userColor : undefined}
          dests={dests}
          lastMove={lastMove}
          check={chess.inCheck()}
          shapes={hint}
          coordinates={profile.settings.coordinates}
          animation={profile.settings.animation}
          theme={profile.settings.boardTheme}
          syncKey={syncKey}
          isPromotion={(o, d) => isPromotionMove(chess, o, d)}
          onMove={(o, d, p) => {
            if (!userMove(toUci(o, d, p))) setSyncKey((k) => k + 1);
          }}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="card flex items-center gap-3">
          <span className="text-4xl">{level.avatar}</span>
          <div className="flex-1">
            <div className="font-bold">
              {level.name} <span className="text-accent">{level.id === 'max' ? 'Tối đa' : level.elo}</span>
            </div>
            <div className="text-sm text-muted">{thinking ? 'Đang suy nghĩ…' : over ? 'Ván đã kết thúc' : 'Đến lượt bạn'}</div>
          </div>
        </div>
        {over && (
          <div className={`card text-center ${over.winner === userColor ? 'bg-good/20' : over.winner ? 'bg-bad/20' : ''}`}>
            <div className="text-2xl font-extrabold">{outcome}</div>
            <div className="text-sm text-muted">{over.reason}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-primary" disabled={savedId === null} onClick={() => savedId && navigate(`/train/review/${savedId}`)}>
                Phân tích ván
              </button>
              <button className="btn" onClick={onNew}>
                Ván mới
              </button>
            </div>
          </div>
        )}
        <MoveTable moves={moves.map((m) => ({ san: m.san }))} current={moves.length - 1} />
        {!over && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={showHint} disabled={turn !== userColor}>
              💡 Gợi ý
            </button>
            <button className="btn" onClick={takeback} disabled={moves.length === 0}>
              ↶ Đi lại
            </button>
            <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
              ⇅ Lật bàn
            </button>
            <button className="btn text-bad" onClick={() => confirm('Xin thua ván này?') && resign()} disabled={moves.length < 2}>
              🏳 Xin thua
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

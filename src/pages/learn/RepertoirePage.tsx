import { useState } from 'react';
import { Link } from 'react-router';
import { Chess } from 'chess.js';
import { useNow } from '../../components/useNow';
import { LineTrainer } from '../../components/LineTrainer';
import { parseUci } from '../../core/chess';
import type { Repertoire } from '../../data/db';
import { deleteRepertoireLine, gradeRepertoireLine, useRepertoire } from '../../data/learn';
import { useProfile } from '../../data/store';
import { formatDue } from '../Review';

const START = new Chess().fen();

function sanLine(moves: string[]): string {
  const c = new Chess();
  return moves
    .map((m, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${c.move(parseUci(m)).san}`)
    .join(' ');
}

export function RepertoirePage() {
  const profile = useProfile();
  const lines = useRepertoire();
  const now = useNow(30_000);
  const [training, setTraining] = useState<{ line: Repertoire; round: number } | null>(null);
  const [result, setResult] = useState<number | null>(null);

  if (!profile || !lines) return null;
  const due = lines.filter((l) => l.due <= now);

  const startNextDue = () => {
    const next = due.find((l) => l.id !== training?.line.id) ?? due[0];
    setResult(null);
    setTraining(next ? { line: next, round: (training?.round ?? 0) + 1 } : null);
  };

  if (training) {
    const { line } = training;
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-150px))]">
          <LineTrainer
            key={training.round}
            fen={START}
            line={line.moves}
            userTurn={line.color === 'white' ? 'w' : 'b'}
            orientation={line.color}
            settings={profile.settings}
            revealAfter={1}
            onDone={(mistakes) => {
              setResult(mistakes);
              void gradeRepertoireLine(line, mistakes);
            }}
          />
        </div>
        <aside className="flex flex-col gap-3">
          <div className="card">
            <div className="text-sm text-muted">Bạn cầm {line.color === 'white' ? 'Trắng' : 'Đen'}</div>
            <div className="font-bold">{line.name}</div>
            <p className="mt-2 text-sm text-muted">Đi lại đúng các nước của bạn trong dòng này. Đi sai, mũi tên sẽ chỉ nước đúng.</p>
          </div>
          {result !== null && (
            <div className={`card text-center ${result === 0 ? 'bg-good/20' : 'bg-bad/20'}`}>
              <div className="text-xl font-bold">{result === 0 ? 'Thuộc bài! 🎉' : `Sai ${result} lần`}</div>
              <div className="text-sm text-muted">{result === 0 ? 'Dòng này sẽ quay lại sau vài ngày.' : 'Dòng này sẽ quay lại sau 10 phút.'}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn btn-primary" onClick={startNextDue} disabled={due.filter((l) => l.id !== line.id).length === 0}>
                  Dòng tiếp
                </button>
                <button className="btn" onClick={() => setTraining(null)}>
                  Danh sách
                </button>
              </div>
            </div>
          )}
          <div className="card font-mono text-xs text-muted">{sanLine(line.moves)}</div>
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">🧠 Repertoire</h1>
        <p className="text-muted">
          Các biến khai cuộc bạn muốn thuộc. Mỗi dòng được hẹn lịch ôn bằng FSRS: thuộc thì lâu mới ôn lại, quên thì ôn sớm.
        </p>
      </div>
      {due.length > 0 && (
        <button className="btn btn-primary py-4 text-lg" onClick={startNextDue}>
          Ôn {due.length} dòng đến hạn
        </button>
      )}
      <div className="card">
        {lines.length === 0 ? (
          <p className="text-sm text-muted">
            Chưa có dòng nào. Vào <Link className="link" to="/learn/openings">Cây khai cuộc</Link>, đi tới biến bạn muốn rồi bấm "Tôi cầm
            Trắng/Đen".
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {lines.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="text-lg">{l.color === 'white' ? '♔' : '♚'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{l.name}</div>
                  <div className="truncate font-mono text-xs text-muted">{sanLine(l.moves)}</div>
                </div>
                <span className="text-xs text-muted">{formatDue(l.due, now)}</span>
                <button className="btn btn-sm py-2" onClick={() => setTraining({ line: l, round: Date.now() })}>
                  Luyện
                </button>
                <button className="btn btn-sm py-2" aria-label="Xóa" onClick={() => confirm('Xóa dòng này?') && deleteRepertoireLine(l.id!)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

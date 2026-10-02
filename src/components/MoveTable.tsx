import { useEffect, useRef } from 'react';

export interface MoveCell {
  san: string;
  /** Optional marker after the move, e.g. a classification icon. */
  mark?: { icon: string; color: string; title: string };
}

/**
 * Moves in numbered rows. `current` is the index of the highlighted move (-1 for the
 * starting position); `firstPly` is 1 when the game starts with Black to move.
 */
export function MoveTable({
  moves,
  current,
  onSelect,
  firstPly = 0,
  firstMoveNumber = 1,
}: {
  moves: MoveCell[];
  current?: number;
  onSelect?: (index: number) => void;
  firstPly?: number;
  firstMoveNumber?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Keep the current move visible by scrolling the list only (scrollIntoView would also scroll the page on phones).
  useEffect(() => {
    const list = box.current;
    const el = list?.querySelector('[data-current="true"]');
    if (!list || !el) return;
    const l = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop += r.top - l.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [current, moves.length]);

  const rows: { num: number; cells: (number | null)[] }[] = [];
  const offset = firstPly;
  for (let i = -offset; i < moves.length; i += 2) {
    rows.push({ num: firstMoveNumber + (i + offset) / 2, cells: [i >= 0 ? i : null, i + 1 < moves.length ? i + 1 : null] });
  }

  return (
    <div ref={box} className="max-h-64 overflow-y-auto rounded-xl bg-panel p-2 font-mono text-sm">
      {moves.length === 0 && <div className="p-2 font-sans text-muted">Chưa có nước nào.</div>}
      {rows.map((row) => (
        <div key={row.num} className="grid grid-cols-[2.5rem_1fr_1fr] items-center">
          <span className="text-muted">{row.num}.</span>
          {row.cells.map((idx, j) =>
            idx === null ? (
              <span key={j} className="px-1.5 text-muted">{j === 0 && row.cells[1] !== null ? '…' : ''}</span>
            ) : (
              <button
                key={j}
                data-current={idx === current}
                onClick={() => onSelect?.(idx)}
                className={`flex items-center gap-1 rounded px-1.5 py-1.5 text-left lg:py-0.5 ${idx === current ? 'bg-accent text-black' : 'hover:bg-white/10'} ${onSelect ? '' : 'cursor-default'}`}
              >
                {moves[idx].san}
                {moves[idx].mark && (
                  <span title={moves[idx].mark!.title} className="text-xs font-bold" style={{ color: idx === current ? undefined : moves[idx].mark!.color }}>
                    {moves[idx].mark!.icon}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

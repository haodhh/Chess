import type { Color } from '@lichess-org/chessground/types';
import { formatScore, winPercent, type Score } from '../engine/uci';

/** Vertical evaluation bar; `score` is from White's point of view. */
export function EvalBar({ score, orientation }: { score: Score | null; orientation: Color }) {
  const white = score ? winPercent(score) : 50;
  const label = score ? formatScore(score) : '…';
  const whiteBottom = orientation === 'white';
  return (
    <div className="relative w-4 shrink-0 overflow-hidden rounded bg-[#403d39] sm:w-6" title={`Đánh giá: ${label}`}>
      <div
        className="absolute left-0 right-0 bg-stone-100 transition-all duration-300"
        style={{ height: `${white}%`, [whiteBottom ? 'bottom' : 'top']: 0 }}
      />
      <div
        className={`absolute left-0 right-0 text-center text-[9px] font-bold sm:text-[10px] ${
          white >= 50 === whiteBottom ? 'bottom-1 text-stone-800' : 'top-1 text-stone-100'
        }`}
      >
        {label.replace('+', '')}
      </div>
    </div>
  );
}

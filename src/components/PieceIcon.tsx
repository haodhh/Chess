import { pieceUrl, usePieceSet, type PieceColor, type PieceRole } from './pieceSet';

/** A piece from the chosen set, e.g. next to "Trắng"/"Đen" (text glyphs like ♚ look white on a dark page). */
export function PieceIcon({ color, role = 'king', className = 'h-6 w-6' }: { color: PieceColor; role?: PieceRole; className?: string }) {
  const set = usePieceSet();
  return <img src={pieceUrl(set, color, role)} alt="" aria-hidden draggable={false} className={`inline-block shrink-0 ${className}`} />;
}

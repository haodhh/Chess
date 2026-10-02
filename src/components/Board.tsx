import { useEffect, useRef, useState } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Color, Key } from '@lichess-org/chessground/types';
import type { Promotion } from '../core/chess';
import type { BoardTheme } from '../data/db';

export interface BoardProps {
  fen: string;
  orientation: Color;
  turnColor: Color;
  /** Side the user may move; leave undefined to make the board read-only. */
  movable?: Color;
  dests?: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check?: boolean;
  shapes?: DrawShape[];
  coordinates?: boolean;
  animation?: boolean;
  theme?: BoardTheme;
  /** Increment to force the board back to `fen`, e.g. after a rejected move. */
  syncKey?: number;
  isPromotion?: (orig: Key, dest: Key) => boolean;
  onMove?: (orig: Key, dest: Key, promotion?: Promotion) => void;
}

const PROMOTION_PIECES: { role: string; letter: Promotion }[] = [
  { role: 'queen', letter: 'q' },
  { role: 'knight', letter: 'n' },
  { role: 'rook', letter: 'r' },
  { role: 'bishop', letter: 'b' },
];

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (orig, dest) => {
            const p = propsRef.current;
            if (p.isPromotion?.(orig, dest)) setPromotion({ orig, dest });
            else p.onMove?.(orig, dest);
          },
        },
      },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      highlight: { lastMove: true, check: true },
    });
    return () => api.current?.destroy();
  }, []);

  const { fen, orientation, turnColor, movable, dests, lastMove, check, coordinates, animation, syncKey } = props;
  useEffect(() => {
    api.current?.set({
      fen,
      orientation,
      turnColor,
      lastMove,
      check: check ? turnColor : false,
      coordinates: coordinates ?? true,
      animation: { enabled: animation ?? true, duration: 220 },
      movable: { color: movable, dests: movable ? dests : new Map() },
      viewOnly: false,
    });
    setPromotion(null);
  }, [fen, orientation, turnColor, movable, dests, lastMove, check, coordinates, animation, syncKey]);

  useEffect(() => {
    api.current?.setAutoShapes(props.shapes ?? []);
  }, [props.shapes]);

  const choose = (letter: Promotion | null) => {
    const p = promotion;
    setPromotion(null);
    if (p && letter) props.onMove?.(p.orig, p.dest, letter);
    else api.current?.set({ fen: props.fen, lastMove: props.lastMove });
  };

  return (
    <div className={`board-frame board-${props.theme ?? 'green'} relative aspect-square w-full select-none`}>
      <div ref={el} className="h-full w-full" />
      {promotion && (
        <PromotionChooser
          dest={promotion.dest}
          orientation={orientation}
          color={movable ?? turnColor}
          onChoose={choose}
        />
      )}
    </div>
  );
}

function PromotionChooser(props: {
  dest: Key;
  orientation: Color;
  color: Color;
  onChoose: (letter: Promotion | null) => void;
}) {
  const file = props.dest.charCodeAt(0) - 97;
  const rank = Number(props.dest[1]) - 1;
  const col = props.orientation === 'white' ? file : 7 - file;
  const atTop = (props.orientation === 'white') === (rank === 7);
  return (
    <div className="promotion-overlay absolute inset-0 z-20 bg-black/50" onClick={() => props.onChoose(null)}>
      {PROMOTION_PIECES.map((p, i) => (
        <button
          key={p.role}
          type="button"
          aria-label={p.role}
          className="absolute flex h-[12.5%] w-[12.5%] items-center justify-center rounded-full bg-stone-200/90 hover:bg-amber-200"
          style={{ left: `${col * 12.5}%`, [atTop ? 'top' : 'bottom']: `${i * 12.5}%` }}
          onClick={(e) => {
            e.stopPropagation();
            props.onChoose(p.letter);
          }}
        >
          {/* Inside .cg-wrap so chessground's piece images apply. */}
          <span className="cg-wrap">
            <piece className={`${p.role} ${props.color}`} />
          </span>
        </button>
      ))}
    </div>
  );
}

import { useSyncExternalStore } from 'react';
import type { PieceSet } from '../data/db';

export const PIECE_SETS: { id: PieceSet; name: string; author: string; license: string }[] = [
  { id: 'cardinal', name: 'Cardinal', author: 'sadsnake1', license: 'CC BY-NC-SA 4.0' },
  { id: 'merida', name: 'Merida', author: 'Armando Hernandez Marroquin', license: 'GPLv2+' },
  { id: 'maestro', name: 'Maestro', author: 'sadsnake1', license: 'CC BY-NC-SA 4.0' },
  { id: 'fresca', name: 'Fresca', author: 'sadsnake1', license: 'CC BY-NC-SA 4.0' },
  { id: 'chessnut', name: 'Chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'cburnett', name: 'Cburnett', author: 'Colin M.L. Burnett', license: 'GPLv2+' },
];

export const DEFAULT_PIECE_SET: PieceSet = 'cardinal';

const LETTER = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' } as const;
export type PieceRole = keyof typeof LETTER;
export type PieceColor = 'white' | 'black';

/** The image of one piece (public/piece/<set>/<wK|bQ|…>.svg). */
export function pieceUrl(set: PieceSet, color: PieceColor, role: PieceRole): string {
  return `${import.meta.env.BASE_URL}piece/${set}/${color[0]}${LETTER[role]}.svg`;
}

const STORAGE_KEY = 'piece-set';
const isPieceSet = (v: unknown): v is PieceSet => PIECE_SETS.some((s) => s.id === v);

let current: PieceSet = DEFAULT_PIECE_SET;
const listeners = new Set<() => void>();

/** The set chosen last time on this device, so the first board already uses it. */
export function storedPieceSet(): PieceSet {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isPieceSet(v)) return v;
  } catch {
    // Storage blocked: use the default.
  }
  return DEFAULT_PIECE_SET;
}

/** Points chessground's <piece> elements at the images of `set`. */
export function applyPieceSet(set: PieceSet) {
  if (!isPieceSet(set)) set = DEFAULT_PIECE_SET;
  let style = document.getElementById('piece-set') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'piece-set';
    document.head.append(style);
  }
  const rules: string[] = [];
  for (const color of ['white', 'black'] as const) {
    for (const role of Object.keys(LETTER) as PieceRole[]) {
      rules.push(`.cg-wrap piece.${role}.${color}{background-image:url("${pieceUrl(set, color, role)}")}`);
    }
  }
  style.textContent = rules.join('\n');
  try {
    localStorage.setItem(STORAGE_KEY, set);
  } catch {
    // Not remembered on this device; the profile setting still applies.
  }
  if (set !== current) {
    current = set;
    listeners.forEach((l) => l());
  }
}

/** The piece set in use, for piece images outside the board. */
export function usePieceSet(): PieceSet {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

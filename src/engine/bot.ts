import type { PvLine } from './uci';
import { winPercent } from './uci';

export interface BotLevel {
  id: string;
  name: string;
  elo: number;
  avatar: string;
  desc: string;
  /** Settings for levels below Stockfish's 1320 floor: pick among weaker moves. */
  weak?: { depth: number; multiPv: number; temperature: number; blunderChance: number };
  movetime?: number;
}

export const BOT_LEVELS: BotLevel[] = [
  { id: 'b400', name: 'Tí', elo: 400, avatar: '🐣', desc: 'Mới tập chơi, hay bỏ quân.', weak: { depth: 2, multiPv: 8, temperature: 18, blunderChance: 0.25 } },
  { id: 'b800', name: 'Bin', elo: 800, avatar: '🐥', desc: 'Biết luật, đôi khi để sót quân.', weak: { depth: 4, multiPv: 6, temperature: 10, blunderChance: 0.12 } },
  { id: 'b1200', name: 'Mai', elo: 1200, avatar: '🦊', desc: 'Chơi chắc tay, thấy đòn đơn giản.', weak: { depth: 6, multiPv: 4, temperature: 5, blunderChance: 0.05 } },
  { id: 'b1600', name: 'Nam', elo: 1600, avatar: '🦉', desc: 'Kỳ thủ câu lạc bộ.', movetime: 600 },
  { id: 'b2000', name: 'Hùng', elo: 2000, avatar: '🦅', desc: 'Kỳ thủ mạnh, ít sai sót.', movetime: 800 },
  { id: 'b2400', name: 'Kiện tướng', elo: 2400, avatar: '🐉', desc: 'Trình độ kiện tướng.', movetime: 1000 },
  { id: 'max', name: 'Stockfish', elo: 3000, avatar: '🤖', desc: 'Sức mạnh tối đa của engine.', movetime: 1200 },
];

/**
 * Chooses a move for a weak bot from MultiPV lines: moves are weighted by
 * exp(-loss / temperature) where loss is the drop in winning chances versus the best line,
 * and occasionally a random listed move is played regardless.
 */
export function pickWeakMove(
  lines: PvLine[],
  weak: NonNullable<BotLevel['weak']>,
  rng: () => number = Math.random,
): string | null {
  const candidates = lines.filter((l) => l.pv.length > 0);
  if (candidates.length === 0) return null;
  if (candidates.length > 1 && rng() < weak.blunderChance) {
    return candidates[1 + Math.floor(rng() * (candidates.length - 1))].pv[0];
  }
  const best = winPercent(candidates[0]);
  const weights = candidates.map((l) => Math.exp(-(best - winPercent(l)) / weak.temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i].pv[0];
  }
  return candidates[0].pv[0];
}

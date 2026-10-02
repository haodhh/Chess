import { Chess } from 'chess.js';
import { getEngine } from './engine';
import type { PositionEval } from './review';

/** Evaluates every position of a game, including the final one. */
export async function analyseGame(
  fens: string[],
  depth: number,
  onProgress: (done: number, total: number) => void,
): Promise<PositionEval[]> {
  const engine = getEngine();
  const out: PositionEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    const c = new Chess(fens[i]);
    if (c.isCheckmate()) out.push({ score: { mate: -1 }, best: null });
    else if (c.isGameOver()) out.push({ score: { cp: 0 }, best: null });
    else {
      const r = await engine.analyse(fens[i], { depth, movetime: 1500 });
      out.push({ score: { cp: r.score.cp, mate: r.score.mate }, best: r.bestMove });
    }
    onProgress(i + 1, fens.length);
  }
  return out;
}

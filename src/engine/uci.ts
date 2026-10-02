// Parsing of UCI engine output and conversions between scores and winning chances.

export interface Score {
  /** Centipawns from the point of view of the side to move. */
  cp?: number;
  /** Moves to mate from the side to move's point of view (negative: getting mated). */
  mate?: number;
}

export interface PvLine extends Score {
  multipv: number;
  depth: number;
  pv: string[];
}

export function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const tokens = line.split(' ');
  const out: PvLine = { multipv: 1, depth: 0, pv: [] };
  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        out.depth = Number(tokens[++i]);
        break;
      case 'multipv':
        out.multipv = Number(tokens[++i]);
        break;
      case 'score': {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        if (kind === 'cp') out.cp = value;
        else if (kind === 'mate') out.mate = value;
        break;
      }
      case 'pv':
        out.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
    }
  }
  if (out.cp === undefined && out.mate === undefined) return null;
  return out;
}

/** Lichess' winning-chances curve: 0–100 for the side the score belongs to. */
export function winPercent(score: Score): number {
  if (score.mate !== undefined) return score.mate > 0 ? 100 : score.mate < 0 ? 0 : 0;
  const cp = Math.max(-1000, Math.min(1000, score.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export const negate = (s: Score): Score =>
  s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) };

/** Short human-readable score, e.g. "+1.3" or "#-3". */
export function formatScore(s: Score): string {
  if (s.mate !== undefined) return `#${s.mate}`;
  const v = (s.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

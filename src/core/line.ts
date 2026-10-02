import { Chess, type Move } from 'chess.js';
import { parseUci } from './chess';

export type LineVerdict = 'wrong' | 'correct' | 'done';

/**
 * A scripted line from a position: the user plays their side's moves and the other
 * side's moves are played automatically. Any checkmating move also completes the line.
 */
export class LineSession {
  readonly chess: Chess;
  ply = 0;
  mistakes = 0;
  readonly userTurn: 'w' | 'b';
  private readonly played: Move[] = [];

  constructor(
    readonly fen: string,
    readonly moves: string[],
    userTurn?: 'w' | 'b',
  ) {
    this.chess = new Chess(fen);
    this.userTurn = userTurn ?? this.chess.turn();
  }

  get isDone() {
    return this.ply >= this.moves.length || this.chess.isCheckmate();
  }

  get isUserTurn() {
    return !this.isDone && this.chess.turn() === this.userTurn;
  }

  get expected(): string | undefined {
    return this.isUserTurn ? this.moves[this.ply] : undefined;
  }

  get lastMove(): Move | undefined {
    return this.played[this.played.length - 1];
  }

  /** Plays the next move of the other side, if it is their turn. */
  playOpponent(): Move | undefined {
    if (this.isDone || this.isUserTurn) return undefined;
    const m = this.chess.move(parseUci(this.moves[this.ply]));
    this.played.push(m);
    this.ply++;
    return m;
  }

  tryMove(uci: string): LineVerdict {
    if (!this.isUserTurn) return 'wrong';
    let m: Move;
    try {
      m = this.chess.move(parseUci(uci));
    } catch {
      this.mistakes++;
      return 'wrong';
    }
    if (uci !== this.moves[this.ply] && !this.chess.isCheckmate()) {
      this.chess.undo();
      this.mistakes++;
      return 'wrong';
    }
    this.played.push(m);
    this.ply++;
    return this.isDone ? 'done' : 'correct';
  }
}

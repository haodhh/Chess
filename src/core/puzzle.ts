import { Chess, type Move } from 'chess.js';
import type { Color } from '@lichess-org/chessground/types';
import { colorOf, opposite, parseUci } from './chess';

export interface Puzzle {
  id: string;
  /** Position before the opponent's setup move. */
  fen: string;
  /** UCI moves: the opponent's setup move followed by the solution, alternating sides. */
  moves: string[];
  rating: number;
  themes: string[];
}

/** How many moves the solver has to find (the first move is the opponent's setup move). */
export function solverMoves(puzzle: Pick<Puzzle, 'moves'>): number {
  return Math.floor(puzzle.moves.length / 2);
}

/** Puzzles whose solution ends in checkmate. */
export function isMatePuzzle(puzzle: Pick<Puzzle, 'themes'>): boolean {
  return puzzle.themes.includes('mate');
}

/**
 * What a puzzle asks for. Lichess puzzles (like Chess.com's) end either in checkmate or as soon
 * as the solver's advantage is decisive, e.g. after winning a piece; "equality" ones ask the
 * solver to save a worse position.
 */
export type PuzzleGoal = 'mate' | 'advantage' | 'equality';

export function puzzleGoal(puzzle: Pick<Puzzle, 'themes'>): PuzzleGoal {
  if (isMatePuzzle(puzzle)) return 'mate';
  return puzzle.themes.includes('equality') ? 'equality' : 'advantage';
}

export type MoveVerdict = 'wrong' | 'correct' | 'solved';

/**
 * Plays through a Lichess-style puzzle: the first move is the opponent's, then the
 * solver must find every move of the solution. Any move that delivers checkmate is
 * accepted, because some puzzles have several mating moves.
 */
export class PuzzleSession {
  readonly chess: Chess;
  /** Index into puzzle.moves of the next move to be played. */
  ply = 0;
  readonly solverColor: Color;
  private readonly played: Move[] = [];

  constructor(readonly puzzle: Puzzle) {
    this.chess = new Chess(puzzle.fen);
    this.solverColor = opposite(colorOf(this.chess.turn()));
  }

  get fen() {
    return this.chess.fen();
  }

  get lastMove(): Move | undefined {
    return this.played[this.played.length - 1];
  }

  get isSolverTurn() {
    return this.ply % 2 === 1 && !this.isComplete;
  }

  get isComplete() {
    return this.ply >= this.puzzle.moves.length || this.chess.isCheckmate();
  }

  /** The solution move the solver should play next, if it is their turn. */
  get expectedMove(): string | undefined {
    return this.isSolverTurn ? this.puzzle.moves[this.ply] : undefined;
  }

  /** Plays the next scripted move (the opponent's setup move or reply). */
  playScripted(): Move {
    const move = this.chess.move(parseUci(this.puzzle.moves[this.ply]));
    this.played.push(move);
    this.ply++;
    return move;
  }

  /** Checks the solver's move. Correct moves are played on the board; wrong moves are not. */
  tryMove(uci: string): MoveVerdict {
    if (!this.isSolverTurn) return 'wrong';
    const expected = this.puzzle.moves[this.ply];
    let move: Move;
    try {
      move = this.chess.move(parseUci(uci));
    } catch {
      return 'wrong';
    }
    const isMate = this.chess.isCheckmate();
    if (uci !== expected && !isMate) {
      this.chess.undo();
      return 'wrong';
    }
    this.played.push(move);
    this.ply++;
    return this.isComplete ? 'solved' : 'correct';
  }

  /** Plays every remaining move of the solution, returning them for animation. */
  *solutionMoves(): Generator<Move> {
    while (!this.isComplete) yield this.playScripted();
  }
}

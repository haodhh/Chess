// Rules of a two-player online game: seating, moves, clocks and results.
// Pure functions over a plain Room object, shared by the Durable Object and the tests.

import { Chess } from 'chess.js';

export type Color = 'white' | 'black';
export const other = (c: Color): Color => (c === 'white' ? 'black' : 'white');

/** Minutes + increment seconds; null for no clock. */
export interface TimeControl {
  initial: number;
  increment: number;
}

export const TIME_CONTROLS: (TimeControl | null)[] = [
  null,
  { initial: 3, increment: 2 },
  { initial: 5, increment: 0 },
  { initial: 10, increment: 0 },
  { initial: 10, increment: 5 },
  { initial: 15, increment: 10 },
  { initial: 30, increment: 0 },
];

/** A room waiting for an opponent, as shown in the lobby. */
export interface LobbyEntry {
  code: string;
  name: string;
  host: string;
  hasPassword: boolean;
  hostColor: Color | 'random';
  time: TimeControl | null;
  createdAt: number;
}

/** How long an unjoined room stays open and listed. */
export const LISTING_MS = 30 * 60_000;

export interface Player {
  token: string;
  nickname: string;
}

export interface GameResult {
  winner: Color | null;
  reason: string;
}

export interface Room {
  code: string;
  name: string;
  createdAt: number;
  passwordHash: string | null;
  salt: string;
  time: TimeControl | null;
  players: Partial<Record<Color, Player>>;
  status: 'waiting' | 'playing' | 'finished';
  /** UCI moves of the current game. */
  moves: string[];
  /** Milliseconds left for each side, as of `turnStartedAt`. */
  clock: Record<Color, number> | null;
  turnStartedAt: number | null;
  result: GameResult | null;
  drawOffer: Color | null;
  rematch: Partial<Record<Color, boolean>>;
  /** Increases with every rematch. */
  game: number;
  /** When each player's last connection closed (absent while connected). */
  awaySince: Partial<Record<Color, number>>;
}

export class GameError extends Error {}

/** Grace period before a player can claim the win against an opponent who left. */
export const ABANDON_MS = 60_000;

export function newRoom(opts: {
  code: string;
  name: string;
  passwordHash: string | null;
  salt: string;
  time: TimeControl | null;
  host: Player;
  hostColor: Color;
  now: number;
}): Room {
  return {
    code: opts.code,
    name: opts.name,
    createdAt: opts.now,
    passwordHash: opts.passwordHash,
    salt: opts.salt,
    time: opts.time,
    players: { [opts.hostColor]: opts.host },
    status: 'waiting',
    moves: [],
    clock: null,
    turnStartedAt: null,
    result: null,
    drawOffer: null,
    rematch: {},
    game: 1,
    awaySince: {},
  };
}

export function colorOfToken(room: Room, token: string): Color | null {
  if (room.players.white?.token === token) return 'white';
  if (room.players.black?.token === token) return 'black';
  return null;
}

function startGame(room: Room, now: number) {
  room.status = 'playing';
  room.moves = [];
  room.result = null;
  room.drawOffer = null;
  room.rematch = {};
  room.turnStartedAt = now;
  room.clock = room.time
    ? { white: room.time.initial * 60_000, black: room.time.initial * 60_000 }
    : null;
}

/** Seats the second player in the free colour and starts the game. */
export function seatPlayer(room: Room, player: Player, now: number): Color {
  if (room.status !== 'waiting') throw new GameError('Phòng đã đủ người.');
  const color: Color = room.players.white ? 'black' : 'white';
  room.players[color] = player;
  startGame(room, now);
  return color;
}

export function chessOf(room: Room): Chess {
  const c = new Chess();
  for (const m of room.moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return c;
}

export const turnOf = (room: Room): Color => (room.moves.length % 2 === 0 ? 'white' : 'black');

/** Clocks start once both players have made their first move. */
const clockRunning = (room: Room) => room.clock !== null && room.moves.length >= 2;

/** Time left for `color` at `now`. */
export function timeLeft(room: Room, color: Color, now: number): number {
  if (!room.clock) return Infinity;
  const base = room.clock[color];
  if (room.status !== 'playing' || turnOf(room) !== color || !clockRunning(room) || room.turnStartedAt === null) {
    return base;
  }
  return base - (now - room.turnStartedAt);
}

/** Whether `color` still has enough material to checkmate (otherwise running out of time is a draw). */
export function canMate(chess: Chess, color: Color): boolean {
  const mine = chess
    .board()
    .flat()
    .filter((p) => p && p.color === color[0] && p.type !== 'k');
  if (mine.length === 0) return false;
  if (mine.length === 1 && (mine[0]!.type === 'n' || mine[0]!.type === 'b')) return false;
  return true;
}

function finish(room: Room, result: GameResult, now: number) {
  room.status = 'finished';
  room.result = result;
  room.drawOffer = null;
  if (room.clock && room.turnStartedAt !== null && clockRunning(room)) {
    const mover = turnOf(room);
    room.clock[mover] = Math.max(0, room.clock[mover] - (now - room.turnStartedAt));
  }
  room.turnStartedAt = null;
}

function gameOverResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'black' : 'white', reason: 'Chiếu hết' };
  if (chess.isStalemate()) return { winner: null, reason: 'Hết nước đi' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Không đủ quân chiếu hết' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Lặp lại thế cờ 3 lần' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'Luật 50 nước' };
  return null;
}

/** Ends the game if the side to move has run out of time. Returns true if it did. */
export function checkFlag(room: Room, now: number): boolean {
  if (room.status !== 'playing' || !room.clock || !clockRunning(room)) return false;
  const mover = turnOf(room);
  if (timeLeft(room, mover, now) > 0) return false;
  const opponent = other(mover);
  const result = canMate(chessOf(room), opponent)
    ? { winner: opponent, reason: 'Hết giờ' }
    : { winner: null, reason: 'Hết giờ, đối phương không đủ quân chiếu hết' };
  finish(room, result, now);
  room.clock[mover] = 0;
  return true;
}

/** When the side to move will run out of time, if a clock is running. */
export function flagAt(room: Room): number | null {
  if (room.status !== 'playing' || !room.clock || !clockRunning(room) || room.turnStartedAt === null) return null;
  return room.turnStartedAt + room.clock[turnOf(room)];
}

export function playMove(room: Room, color: Color, uci: string, now: number) {
  if (room.status !== 'playing') throw new GameError('Ván cờ chưa bắt đầu hoặc đã kết thúc.');
  if (turnOf(room) !== color) throw new GameError('Chưa đến lượt bạn.');
  if (checkFlag(room, now)) return;
  const chess = chessOf(room);
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    throw new GameError('Nước đi không hợp lệ.');
  }
  if (room.clock && clockRunning(room) && room.turnStartedAt !== null) {
    room.clock[color] = room.clock[color] - (now - room.turnStartedAt) + (room.time?.increment ?? 0) * 1000;
  }
  room.moves.push(uci);
  room.turnStartedAt = now;
  room.drawOffer = null;
  const over = gameOverResult(chess);
  if (over) finish(room, over, now);
}

export function resign(room: Room, color: Color, now: number) {
  if (room.status !== 'playing') throw new GameError('Không có ván nào đang diễn ra.');
  finish(room, { winner: other(color), reason: `${color === 'white' ? 'Trắng' : 'Đen'} xin thua` }, now);
}

export function offerDraw(room: Room, color: Color, now: number) {
  if (room.status !== 'playing') throw new GameError('Không có ván nào đang diễn ra.');
  if (room.drawOffer === other(color)) {
    finish(room, { winner: null, reason: 'Hai bên đồng ý hòa' }, now);
    return;
  }
  room.drawOffer = color;
}

export function declineDraw(room: Room, color: Color) {
  if (room.drawOffer === other(color)) room.drawOffer = null;
}

/** The player whose opponent has been gone for a while may take the win. */
export function claimVictory(room: Room, color: Color, now: number) {
  if (room.status !== 'playing') throw new GameError('Không có ván nào đang diễn ra.');
  const away = room.awaySince[other(color)];
  if (away === undefined || now - away < ABANDON_MS) throw new GameError('Đối thủ chưa rời ván đủ lâu.');
  finish(room, { winner: color, reason: 'Đối thủ đã rời ván' }, now);
}

/** Both players asking for a rematch starts a new game with colours swapped. */
export function requestRematch(room: Room, color: Color, now: number) {
  if (room.status !== 'finished') throw new GameError('Ván cờ chưa kết thúc.');
  if (!room.players.white || !room.players.black) throw new GameError('Đối thủ đã rời phòng.');
  room.rematch[color] = true;
  if (room.rematch.white && room.rematch.black) {
    room.players = { white: room.players.black, black: room.players.white };
    room.awaySince = { white: room.awaySince.black, black: room.awaySince.white };
    room.game++;
    startGame(room, now);
  }
}

/** What clients may see: no tokens or password hash. */
export function publicView(room: Room, connected: Record<Color, boolean>, now: number) {
  const seat = (c: Color) => {
    const p = room.players[c];
    return p ? { nickname: p.nickname, connected: connected[c], awaySince: room.awaySince[c] ?? null } : null;
  };
  return {
    code: room.code,
    name: room.name,
    hasPassword: room.passwordHash !== null,
    time: room.time,
    status: room.status,
    players: { white: seat('white'), black: seat('black') },
    moves: room.moves,
    clock: room.clock ? { white: timeLeft(room, 'white', now), black: timeLeft(room, 'black', now) } : null,
    clockRunning: clockRunning(room) && room.status === 'playing',
    result: room.result,
    drawOffer: room.drawOffer,
    rematch: room.rematch,
    game: room.game,
    serverNow: now,
  };
}

export type RoomView = ReturnType<typeof publicView>;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function randomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

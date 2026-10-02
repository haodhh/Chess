import { DurableObject } from 'cloudflare:workers';
import {
  checkFlag,
  claimVictory,
  colorOfToken,
  declineDraw,
  flagAt,
  GameError,
  hashPassword,
  newRoom,
  offerDraw,
  playMove,
  publicView,
  randomToken,
  requestRematch,
  resign,
  seatPlayer,
  type Color,
  type Room,
  type TimeControl,
  LISTING_MS,
} from './game';
import type { Lobby } from './lobby';

export interface Env {
  ROOMS: DurableObjectNamespace<ChessRoom>;
  LOBBY: DurableObjectNamespace<Lobby>;
  ASSETS: Fetcher;
}

export interface CreateOptions {
  code: string;
  name: string;
  password: string;
  nickname: string;
  color: Color | 'random';
  time: TimeControl | null;
}

export type Seat = { token: string; color: Color };

/** Finished rooms are kept for a day so players can still open them. */
const KEEP_FINISHED_MS = 24 * 3600_000;

type ClientMessage =
  | { t: 'move'; uci: string; game: number }
  | { t: 'resign' }
  | { t: 'draw' }
  | { t: 'decline-draw' }
  | { t: 'rematch' }
  | { t: 'claim' };

/** One room: up to two players, their WebSockets and the game between them. */
export class ChessRoom extends DurableObject<Env> {
  private room: Room | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>('room')) ?? null;
    });
  }

  private lobby() {
    return this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
  }

  private async save() {
    await this.ctx.storage.put('room', this.room);
    await this.scheduleAlarm();
  }

  private async scheduleAlarm() {
    const r = this.room;
    if (!r) return;
    const times = [
      flagAt(r),
      r.status === 'waiting' ? r.createdAt + LISTING_MS : null,
      r.status === 'finished' ? Date.now() + KEEP_FINISHED_MS : null,
    ].filter((t): t is number => t !== null);
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  async create(opts: CreateOptions): Promise<Seat | { error: string }> {
    if (this.room) return { error: 'exists' };
    const salt = randomToken();
    const color: Color = opts.color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : opts.color;
    const token = randomToken();
    this.room = newRoom({
      code: opts.code,
      name: opts.name,
      passwordHash: opts.password ? await hashPassword(salt, opts.password) : null,
      salt,
      time: opts.time,
      host: { token, nickname: opts.nickname },
      hostColor: color,
      now: Date.now(),
    });
    await this.save();
    await this.lobby().add({
      code: opts.code,
      name: opts.name,
      host: opts.nickname,
      hasPassword: !!opts.password,
      hostColor: opts.color,
      time: opts.time,
      createdAt: this.room.createdAt,
    });
    return { token, color };
  }

  async info() {
    const r = this.room;
    if (!r) return null;
    return { ...publicView(r, this.connected(), Date.now()), seatsFree: r.status === 'waiting' };
  }

  async join(nickname: string, password: string): Promise<Seat | { error: string }> {
    const r = this.room;
    if (!r) return { error: 'Không tìm thấy phòng.' };
    if (r.passwordHash && (await hashPassword(r.salt, password)) !== r.passwordHash) {
      return { error: 'Sai mật khẩu phòng.' };
    }
    if (r.status !== 'waiting') return { error: 'Phòng đã đủ 2 người.' };
    const token = randomToken();
    const color = seatPlayer(r, { token, nickname }, Date.now());
    await this.save();
    await this.lobby().remove(r.code);
    this.broadcast();
    return { token, color };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const color = this.room ? colorOfToken(this.room, token) : null;
    if (!this.room || !color) return new Response('Không có quyền vào phòng này', { status: 403 });
    const pair = new WebSocketPair();
    // Sockets are tagged with the player's token, not colour: colours swap on a rematch.
    this.ctx.acceptWebSocket(pair[1], [token]);
    pair[1].serializeAttachment({ token });
    delete this.room.awaySince[color];
    await this.save();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const r = this.room;
    const color = this.colorOf(ws);
    if (!r || !color) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const now = Date.now();
    try {
      switch (msg.t) {
        case 'move':
          // Ignore moves meant for a previous game in this room.
          if (msg.game !== r.game) return;
          playMove(r, color, String(msg.uci), now);
          break;
        case 'resign':
          resign(r, color, now);
          break;
        case 'draw':
          offerDraw(r, color, now);
          break;
        case 'decline-draw':
          declineDraw(r, color);
          break;
        case 'rematch':
          requestRematch(r, color, now);
          break;
        case 'claim':
          claimVictory(r, color, now);
          break;
        default:
          return;
      }
    } catch (e) {
      if (e instanceof GameError) {
        ws.send(JSON.stringify({ t: 'error', message: e.message }));
        this.sendState(ws);
        return;
      }
      throw e;
    }
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket) {
    const color = this.colorOf(ws);
    if (!this.room || !color) return;
    const { token } = ws.deserializeAttachment() as { token: string };
    const stillHere = this.ctx.getWebSockets(token).some((s) => s !== ws && s.readyState === WebSocket.OPEN);
    if (!stillHere) {
      this.room.awaySince[color] = Date.now();
      await this.save();
      this.broadcast();
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    if (r.status === 'waiting' && now - r.createdAt >= LISTING_MS) {
      // Nobody joined: close the room.
      await this.lobby().remove(r.code);
      for (const ws of this.ctx.getWebSockets()) ws.close(4000, 'Phòng đã hết hạn');
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    if (r.status === 'finished' && this.ctx.getWebSockets().length === 0) {
      // Nobody has touched the finished room for a day.
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    if (checkFlag(r, now)) this.broadcast();
    await this.save();
  }

  private colorOf(ws: WebSocket): Color | null {
    const { token } = ws.deserializeAttachment() as { token: string };
    return this.room ? colorOfToken(this.room, token) : null;
  }

  private connected(): Record<Color, boolean> {
    const open = (c: Color) => {
      const token = this.room?.players[c]?.token;
      return !!token && this.ctx.getWebSockets(token).some((s) => s.readyState === WebSocket.OPEN);
    };
    return { white: open('white'), black: open('black') };
  }

  private sendState(ws: WebSocket) {
    if (!this.room) return;
    const color = this.colorOf(ws);
    if (!color) return;
    try {
      ws.send(JSON.stringify({ t: 'state', you: color, room: publicView(this.room, this.connected(), Date.now()) }));
    } catch {
      // The socket is closing; it will get the state when it reconnects.
    }
  }

  private broadcast() {
    for (const ws of this.ctx.getWebSockets()) this.sendState(ws);
  }
}

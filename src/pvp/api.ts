// Client for the online play server (Cloudflare Worker in worker/).

import type { LobbyEntry, RoomView, TimeControl } from '../../worker/game';

export type { RoomView, TimeControl, LobbyEntry };
export { TIME_CONTROLS } from '../../worker/game';

/** Same origin when the app is served by the Worker; set VITE_PVP_SERVER to use another host. */
const SERVER: string = (import.meta.env.VITE_PVP_SERVER as string | undefined) ?? '';
const API = `${SERVER}/api/pvp`;

export function wsUrl(code: string, token: string): string {
  const base = SERVER || `${location.protocol}//${location.host}`;
  return `${base.replace(/^http/, 'ws')}/api/pvp/rooms/${code}/ws?token=${encodeURIComponent(token)}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch {
    throw new Error('Không kết nối được tới máy chủ.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
  return data;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function serverAvailable(): Promise<boolean> {
  try {
    return (await call<{ ok: boolean }>('/health')).ok === true;
  } catch {
    return false;
  }
}

export const listRooms = () => call<{ rooms: LobbyEntry[] }>('/lobby').then((r) => r.rooms);

export interface Seat {
  token: string;
  color: 'white' | 'black';
}

export const createRoom = (opts: {
  nickname: string;
  name: string;
  password: string;
  color: 'white' | 'black' | 'random';
  time: TimeControl | null;
}) => call<Seat & { code: string }>('/rooms', post(opts));

export const roomInfo = (code: string) => call<RoomView & { seatsFree: boolean }>(`/rooms/${code}`);

export const joinRoom = (code: string, nickname: string, password: string) =>
  call<Seat>(`/rooms/${code}/join`, post({ nickname, password }));

// ---------- seats remembered in this browser ----------

interface SavedSeat {
  token: string;
  name: string;
  joinedAt: number;
}

const SEATS = 'pvp-seats';
const NICK = 'pvp-nickname';

function readSeats(): Record<string, SavedSeat> {
  try {
    return JSON.parse(localStorage.getItem(SEATS) ?? '{}') as Record<string, SavedSeat>;
  } catch {
    return {};
  }
}

export function savedSeat(code: string): SavedSeat | undefined {
  return readSeats()[code];
}

export function rememberSeat(code: string, token: string, name: string) {
  const seats = readSeats();
  seats[code] = { token, name, joinedAt: Date.now() };
  // Keep the 20 most recent rooms.
  const recent = Object.entries(seats)
    .sort((a, b) => b[1].joinedAt - a[1].joinedAt)
    .slice(0, 20);
  try {
    localStorage.setItem(SEATS, JSON.stringify(Object.fromEntries(recent)));
  } catch {
    // Without storage the seat only lasts for this visit.
  }
}

export function recentSeats(): (SavedSeat & { code: string })[] {
  return Object.entries(readSeats())
    .map(([code, s]) => ({ code, ...s }))
    .sort((a, b) => b.joinedAt - a.joinedAt);
}

export function getNickname(): string {
  try {
    return localStorage.getItem(NICK) ?? '';
  } catch {
    return '';
  }
}

export function setNickname(name: string) {
  try {
    localStorage.setItem(NICK, name);
  } catch {
    // Only a convenience.
  }
}

export const formatTime = (t: TimeControl | null) => (t ? `${t.initial}+${t.increment}` : 'Không giới hạn');

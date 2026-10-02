// Cloudflare Worker: serves the static app (dist/) and the online play API.
import { randomCode, TIME_CONTROLS, type TimeControl } from './game';
import type { CreateOptions, Env } from './room';

export { ChessRoom } from './room';
export { Lobby } from './lobby';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const fail = (message: string, status = 400) => json({ error: message }, status);

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const validCode = (code: string) => /^[A-Z0-9]{6}$/.test(code);

function parseTime(v: unknown): TimeControl | null | undefined {
  if (v === null) return null;
  const t = v as TimeControl | undefined;
  return TIME_CONTROLS.find((c) => c && t && c.initial === t.initial && c.increment === t.increment) ?? undefined;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function api(request: Request, env: Env, path: string[]): Promise<Response> {
  const room = (code: string) => env.ROOMS.get(env.ROOMS.idFromName(code));

  // GET /api/pvp/health
  if (path[0] === 'health') return json({ ok: true });

  // GET /api/pvp/lobby
  if (path[0] === 'lobby' && request.method === 'GET') {
    return json({ rooms: await env.LOBBY.get(env.LOBBY.idFromName('lobby')).list() });
  }

  if (path[0] !== 'rooms') return fail('Không tìm thấy', 404);

  // POST /api/pvp/rooms
  if (path.length === 1 && request.method === 'POST') {
    const body = await readJson(request);
    const nickname = text(body.nickname, 20);
    const time = parseTime(body.time);
    const color = body.color === 'white' || body.color === 'black' ? body.color : 'random';
    if (!nickname) return fail('Hãy nhập tên của bạn.');
    if (time === undefined) return fail('Thời gian không hợp lệ.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const opts: CreateOptions = {
        code: randomCode(),
        name: text(body.name, 40) || `Phòng của ${nickname}`,
        password: text(body.password, 50),
        nickname,
        color,
        time,
      };
      const seat = await room(opts.code).create(opts);
      if (!('error' in seat)) return json({ code: opts.code, ...seat });
    }
    return fail('Không tạo được phòng, hãy thử lại.', 500);
  }

  const code = (path[1] ?? '').toUpperCase();
  if (!validCode(code)) return fail('Mã phòng không hợp lệ.', 404);

  // GET /api/pvp/rooms/:code
  if (path.length === 2 && request.method === 'GET') {
    const info = await room(code).info();
    return info ? json(info) : fail('Không tìm thấy phòng.', 404);
  }

  // POST /api/pvp/rooms/:code/join
  if (path[2] === 'join' && request.method === 'POST') {
    const body = await readJson(request);
    const nickname = text(body.nickname, 20);
    if (!nickname) return fail('Hãy nhập tên của bạn.');
    const seat = await room(code).join(nickname, text(body.password, 50));
    return 'error' in seat ? fail(seat.error, 403) : json(seat);
  }

  // GET /api/pvp/rooms/:code/ws?token=… (WebSocket)
  if (path[2] === 'ws') return room(code).fetch(request);

  return fail('Không tìm thấy', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/pvp')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const path = url.pathname.replace(/^\/api\/pvp\/?/, '').split('/').filter(Boolean);
      try {
        return await api(request, env, path);
      } catch (e) {
        console.error(e);
        return fail('Lỗi máy chủ.', 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

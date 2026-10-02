import { DurableObject } from 'cloudflare:workers';
import { LISTING_MS, type LobbyEntry } from './game';

/** The list of rooms waiting for an opponent (a single instance). */
export class Lobby extends DurableObject {
  async add(entry: LobbyEntry) {
    await this.ctx.storage.put(`room:${entry.code}`, entry);
  }

  async remove(code: string) {
    await this.ctx.storage.delete(`room:${code}`);
  }

  async list(): Promise<LobbyEntry[]> {
    const now = Date.now();
    const rooms = await this.ctx.storage.list<LobbyEntry>({ prefix: 'room:' });
    const out: LobbyEntry[] = [];
    for (const [key, entry] of rooms) {
      if (now - entry.createdAt > LISTING_MS) await this.ctx.storage.delete(key);
      else out.push(entry);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }
}

import { describe, expect, it } from 'vitest';
import {
  ABANDON_MS,
  checkFlag,
  claimVictory,
  flagAt,
  hashPassword,
  newRoom,
  offerDraw,
  playMove,
  publicView,
  requestRematch,
  resign,
  seatPlayer,
  timeLeft,
  type Room,
} from './game';

const host = { token: 'host', nickname: 'An' };
const guest = { token: 'guest', nickname: 'Bình' };
const both = { white: true, black: true };

function room(time: Room['time'] = { initial: 1, increment: 2 }): Room {
  const r = newRoom({ code: 'ABC123', name: 'Phòng', passwordHash: null, salt: 's', time, host, hostColor: 'white', now: 0 });
  seatPlayer(r, guest, 1000);
  return r;
}

describe('online game', () => {
  it('seats the guest in the free colour and starts the game', () => {
    const r = room();
    expect(r.players.black).toEqual(guest);
    expect(r.status).toBe('playing');
    expect(() => seatPlayer(r, { token: 'x', nickname: 'C' }, 2000)).toThrow();
  });

  it('validates turn order and legality', () => {
    const r = room();
    expect(() => playMove(r, 'black', 'e7e5', 2000)).toThrow('Chưa đến lượt');
    expect(() => playMove(r, 'white', 'e2e5', 2000)).toThrow('không hợp lệ');
    playMove(r, 'white', 'e2e4', 2000);
    expect(r.moves).toEqual(['e2e4']);
  });

  it('starts clocks after both first moves and adds the increment', () => {
    const r = room();
    playMove(r, 'white', 'e2e4', 50_000);
    playMove(r, 'black', 'e7e5', 90_000);
    expect(r.clock).toEqual({ white: 60_000, black: 60_000 });
    playMove(r, 'white', 'g1f3', 100_000); // 10 s used, +2 s increment
    expect(r.clock!.white).toBe(52_000);
    expect(timeLeft(r, 'black', 105_000)).toBe(55_000);
    expect(flagAt(r)).toBe(160_000);
  });

  it('flags a player who runs out of time', () => {
    const r = room();
    playMove(r, 'white', 'e2e4', 2000);
    playMove(r, 'black', 'e7e5', 3000);
    expect(checkFlag(r, 62_000)).toBe(false);
    expect(checkFlag(r, 63_001)).toBe(true);
    expect(r.result).toEqual({ winner: 'black', reason: 'Hết giờ' });
    expect(r.clock!.white).toBe(0);
  });

  it('ends the game on checkmate', () => {
    const r = room(null);
    for (const [c, m] of [['white', 'f2f3'], ['black', 'e7e5'], ['white', 'g2g4'], ['black', 'd8h4']] as const) {
      playMove(r, c, m, 2000);
    }
    expect(r.status).toBe('finished');
    expect(r.result).toEqual({ winner: 'black', reason: 'Chiếu hết' });
  });

  it('handles draw offers, resignation and rematch with swapped colours', () => {
    const r = room(null);
    offerDraw(r, 'white', 2000);
    expect(r.drawOffer).toBe('white');
    playMove(r, 'white', 'e2e4', 2100); // moving clears the offer
    expect(r.drawOffer).toBeNull();
    offerDraw(r, 'black', 2200);
    offerDraw(r, 'white', 2300);
    expect(r.result).toEqual({ winner: null, reason: 'Hai bên đồng ý hòa' });

    requestRematch(r, 'white', 3000);
    expect(r.status).toBe('finished');
    requestRematch(r, 'black', 3100);
    expect(r.status).toBe('playing');
    expect(r.players.white).toEqual(guest);
    expect(r.game).toBe(2);

    resign(r, 'black', 4000);
    expect(r.result!.winner).toBe('white');
  });

  it('lets a player claim the win after the opponent has been away', () => {
    const r = room(null);
    r.awaySince.black = 10_000;
    expect(() => claimVictory(r, 'white', 10_000 + ABANDON_MS - 1)).toThrow();
    claimVictory(r, 'white', 10_000 + ABANDON_MS);
    expect(r.result!.winner).toBe('white');
  });

  it('never exposes tokens or the password hash', async () => {
    const r = room();
    r.passwordHash = await hashPassword('s', 'secret');
    const json = JSON.stringify(publicView(r, both, 2000));
    expect(json).not.toContain('host');
    expect(json).not.toContain(r.passwordHash);
    expect(publicView(r, both, 2000).hasPassword).toBe(true);
  });

  it('hashes passwords with the salt', async () => {
    expect(await hashPassword('a', 'pw')).toBe(await hashPassword('a', 'pw'));
    expect(await hashPassword('a', 'pw')).not.toBe(await hashPassword('b', 'pw'));
  });
});

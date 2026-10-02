import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { bookPlies, buildBook, epdOf, nodeAt, openingOf } from './openings';

const book = buildBook(JSON.parse(readFileSync('public/data/openings.json', 'utf8')).openings);

function line(sans: string[]) {
  const c = new Chess();
  const moves: string[] = [];
  const epds: string[] = [];
  for (const san of sans) {
    const m = c.move(san);
    moves.push(m.from + m.to + (m.promotion ?? ''));
    epds.push(epdOf(c.fen()));
  }
  return { moves, epds };
}

describe('openings', () => {
  it('names openings and transpositions', () => {
    expect(openingOf(book, line(['e4', 'c5']).epds)?.name).toBe('Sicilian Defense');
    // The French reached via 1.d4 e6 2.e4 d5 is still the French.
    expect(openingOf(book, line(['d4', 'e6', 'e4', 'd5']).epds)?.name).toMatch(/^French Defense/);
  });

  it('counts book moves until the game leaves theory', () => {
    const { moves, epds } = line(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Kf1', 'Nf6']);
    expect(bookPlies(book, moves, epds)).toBe(6);
  });

  it('exposes continuations from a position', () => {
    const node = nodeAt(book, line(['e4']).moves)!;
    expect([...node.children.keys()]).toEqual(expect.arrayContaining(['c7c5', 'e7e5', 'e7e6', 'c7c6']));
  });
});

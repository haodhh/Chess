export interface Opening {
  eco: string;
  name: string;
  uci: string[];
  epd: string;
}

export interface OpeningNode {
  children: Map<string, OpeningNode>;
  /** The opening whose main line ends exactly here, if any. */
  opening?: Opening;
  /** Number of named lines passing through this node. */
  lines: number;
}

export interface OpeningBook {
  list: Opening[];
  root: OpeningNode;
  byEpd: Map<string, Opening>;
}

export const epdOf = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function buildBook(rows: [string, string, string, string][]): OpeningBook {
  const root: OpeningNode = { children: new Map(), lines: 0 };
  const byEpd = new Map<string, Opening>();
  const list: Opening[] = [];
  for (const [eco, name, uci, epd] of rows) {
    const o: Opening = { eco, name, uci: uci.split(' '), epd };
    list.push(o);
    if (!byEpd.has(epd)) byEpd.set(epd, o);
    let node = root;
    node.lines++;
    for (const m of o.uci) {
      let next = node.children.get(m);
      if (!next) node.children.set(m, (next = { children: new Map(), lines: 0 }));
      next.lines++;
      node = next;
    }
    node.opening ??= o;
  }
  return { list, root, byEpd };
}

export function nodeAt(book: OpeningBook, moves: string[]): OpeningNode | undefined {
  let node: OpeningNode | undefined = book.root;
  for (const m of moves) node = node?.children.get(m);
  return node;
}

/**
 * Number of leading moves that are known opening theory: either on a named line
 * or reaching a named position by transposition. `epds` are the positions after each move.
 */
export function bookPlies(book: OpeningBook, moves: string[], epds: string[]): number {
  let node: OpeningNode | undefined = book.root;
  let plies = 0;
  for (let i = 0; i < moves.length; i++) {
    node = node?.children.get(moves[i]);
    if (node || book.byEpd.has(epds[i])) plies = i + 1;
    else break;
  }
  return plies;
}

/** The most specific named opening reached by the moves, matching positions to allow transpositions. */
export function openingOf(book: OpeningBook, epds: string[]): Opening | undefined {
  for (let i = epds.length - 1; i >= 0; i--) {
    const o = book.byEpd.get(epds[i]);
    if (o) return o;
  }
  return undefined;
}

let bookPromise: Promise<OpeningBook> | undefined;
export function loadOpenings(): Promise<OpeningBook> {
  bookPromise ??= fetch(`${import.meta.env.BASE_URL}data/openings.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Không tải được dữ liệu khai cuộc (${r.status})`);
      return r.json() as Promise<{ openings: [string, string, string, string][] }>;
    })
    .then((d) => buildBook(d.openings))
    .catch((e) => {
      bookPromise = undefined;
      throw e;
    });
  return bookPromise;
}

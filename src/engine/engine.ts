import { parseInfo, type PvLine, type Score } from './uci';

export interface AnalyseOptions {
  depth?: number;
  movetime?: number;
  multiPv?: number;
  /** Plays at roughly this Elo (1320–3190) using Stockfish's built-in strength limit. */
  elo?: number;
  /** Called with the current lines whenever the engine reports progress. */
  onUpdate?: (lines: PvLine[]) => void;
}

export interface AnalysisResult {
  bestMove: string | null;
  lines: PvLine[];
  /** Score of the best line, from the side to move. */
  score: Score;
}

interface Job {
  fen: string;
  opts: AnalyseOptions;
  resolve: (r: AnalysisResult) => void;
  reject: (e: unknown) => void;
}

const engineUrl = () => `${import.meta.env.BASE_URL}engine/stockfish.js`;

/**
 * A Stockfish worker that runs one search at a time. Jobs are queued; starting a
 * job with `interrupt` stops the current search and drops queued ones.
 */
class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines: PvLine[] = [];
  private listeners = new Set<(line: string) => void>();

  private start(): Promise<void> {
    this.ready ??= new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(engineUrl());
      } catch (e) {
        reject(e);
        return;
      }
      this.worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
      this.worker.onerror = (e) => reject(new Error(e.message || 'Không khởi động được Stockfish'));
      const waitFor = (token: string, then: () => void) => {
        const l = (line: string) => {
          if (line.startsWith(token)) {
            this.listeners.delete(l);
            then();
          }
        };
        this.listeners.add(l);
      };
      waitFor('uciok', () => {
        this.send('setoption name Hash value 32');
        waitFor('readyok', resolve);
        this.send('isready');
      });
      this.send('uci');
    });
    return this.ready;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private onLine(line: string) {
    for (const l of [...this.listeners]) l(line);
    const job = this.current;
    if (!job) return;
    const info = parseInfo(line);
    if (info) {
      this.lines[info.multipv - 1] = info;
      job.opts.onUpdate?.(this.lines.filter(Boolean));
      return;
    }
    if (line.startsWith('bestmove')) {
      const move = line.split(' ')[1];
      const lines = this.lines.filter(Boolean);
      this.current = null;
      job.resolve({
        bestMove: move && move !== '(none)' ? move : null,
        lines,
        score: lines[0] ?? { cp: 0 },
      });
      this.next();
    }
  }

  private next() {
    if (this.current || this.queue.length === 0) return;
    const job = (this.current = this.queue.shift()!);
    this.lines = [];
    const { opts } = job;
    if (opts.elo) {
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(opts.elo)))}`);
    } else {
      this.send('setoption name UCI_LimitStrength value false');
    }
    this.send(`setoption name MultiPV value ${opts.multiPv ?? 1}`);
    this.send(`position fen ${job.fen}`);
    const limits = [opts.depth ? `depth ${opts.depth}` : '', opts.movetime ? `movetime ${opts.movetime}` : '']
      .filter(Boolean)
      .join(' ');
    this.send(`go ${limits || 'depth 12'}`);
  }

  async analyse(fen: string, opts: AnalyseOptions = {}, interrupt = false): Promise<AnalysisResult> {
    await this.start();
    if (interrupt) this.cancelAll();
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      this.next();
    });
  }

  /** Drops queued jobs and stops the running search (its promise still resolves). */
  cancelAll() {
    for (const job of this.queue) job.reject(new DOMException('Cancelled', 'AbortError'));
    this.queue = [];
    if (this.current) this.send('stop');
  }
}

let shared: Engine | null = null;
export function getEngine(): Engine {
  shared ??= new Engine();
  return shared;
}

export const isCancelled = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

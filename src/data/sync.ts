// Online save: keeps a copy of all data in a private GitHub Gist owned by the user.
// The app is a static site, so the gist is the "server"; the access token stays in
// this browser's localStorage and is never included in backups or the gist itself.

import { useSyncExternalStore } from 'react';
import { db } from './db';
import { mergeTables, sameTables, SYNC_TABLES, type Tables } from './merge';
import { exportTables, parseBackup, replaceTables } from './store';

const API = 'https://api.github.com';
export const GIST_FILE = 'co-vua-luyen-tap.json';
const GIST_DESCRIPTION = 'Cờ Vua Luyện Tập – dữ liệu luyện tập (tự động đồng bộ)';
const CONFIG_KEY = 'chess-trainer-sync';
const AUTO_DELAY_MS = 15_000;

export interface SyncConfig {
  token: string;
  login: string;
  gistId: string;
  gistUrl: string;
  auto: boolean;
}

export interface SyncState {
  config: SyncConfig | null;
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: number | null;
  error: string | null;
  /** Local changes not yet uploaded. */
  dirty: boolean;
}

// ---------- state shared with React ----------

function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
  } catch {
    return null;
  }
}

function loadLastSync(): number | null {
  try {
    return Number(localStorage.getItem(`${CONFIG_KEY}-last`)) || null;
  } catch {
    return null;
  }
}

let state: SyncState = { config: loadConfig(), status: 'idle', lastSyncAt: loadLastSync(), error: null, dirty: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function saveConfig(config: SyncConfig | null) {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Without localStorage the connection only lasts for this visit.
  }
  setState({ config });
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ---------- GitHub API ----------

class SyncError extends Error {}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new SyncError('Không kết nối được tới GitHub. Kiểm tra mạng rồi thử lại.');
  }
  if (res.status === 401) throw new SyncError('Token không hợp lệ hoặc đã hết hạn.');
  if (res.status === 403 || res.status === 404) {
    throw new SyncError('Token không có quyền với Gist. Hãy tạo token có quyền "gist".');
  }
  if (!res.ok) throw new SyncError(`GitHub trả về lỗi ${res.status}.`);
  return res.json() as Promise<T>;
}

interface Gist {
  id: string;
  html_url: string;
  description: string | null;
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | undefined>;
}

async function findOrCreateGist(token: string): Promise<Gist> {
  for (let page = 1; page <= 5; page++) {
    const gists = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const found = gists.find((g) => g.files[GIST_FILE]);
    if (found) return found;
    if (gists.length < 100) break;
  }
  return gh<Gist>(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify({ app: 'chess-trainer', version: 3, tables: {} }) } },
    }),
  });
}

async function readRemote(config: SyncConfig): Promise<Tables> {
  const gist = await gh<Gist>(config.token, `/gists/${config.gistId}`);
  const file = gist.files[GIST_FILE];
  if (!file) return {};
  let content = file.content ?? '';
  // The API cuts files above ~1 MB; the raw URL has the full content.
  if (file.truncated && file.raw_url) {
    const res = await fetch(file.raw_url);
    if (!res.ok) throw new SyncError(`Không tải được dữ liệu online (lỗi ${res.status}).`);
    content = await res.text();
  }
  return content.trim() ? parseBackup(content) : {};
}

async function writeRemote(config: SyncConfig, tables: Tables) {
  const content = JSON.stringify({ app: 'chess-trainer', version: 3, exportedAt: new Date().toISOString(), tables });
  await gh(config.token, `/gists/${config.gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
  });
}

// ---------- syncing ----------

/** True while sync itself writes to the database, so those writes do not count as changes. */
let applying = false;
let running: Promise<void> | null = null;
let timer: number | undefined;

/** Connects with a GitHub token: checks it, then finds or creates the data gist and syncs. */
export async function connect(token: string): Promise<void> {
  const t = token.trim();
  const user = await gh<{ login: string }>(t, '/user');
  const gist = await findOrCreateGist(t);
  saveConfig({ token: t, login: user.login, gistId: gist.id, gistUrl: gist.html_url, auto: true });
  await syncNow();
}

export function disconnect() {
  window.clearTimeout(timer);
  saveConfig(null);
  setState({ status: 'idle', error: null, dirty: false });
}

export function setAutoSync(auto: boolean) {
  if (state.config) saveConfig({ ...state.config, auto });
}

/** Downloads the online copy, merges it with local data, and uploads the result. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    const config = state.config;
    if (!config) return;
    window.clearTimeout(timer);
    setState({ status: 'syncing', error: null, dirty: false });
    try {
      const remote = await readRemote(config);
      // Read, merge and write locally in one transaction, so a puzzle solved meanwhile is not lost.
      let merged: Tables = {};
      applying = true;
      try {
        await db.transaction('rw', SYNC_TABLES.map((n) => db.table(n)), async () => {
          const local = await exportTables();
          merged = mergeTables(local, remote);
          if (!sameTables(merged, local)) await replaceTables(merged);
        });
      } finally {
        applying = false;
      }
      if (!sameTables(merged, remote)) await writeRemote(config, merged);
      const now = Date.now();
      try {
        localStorage.setItem(`${CONFIG_KEY}-last`, String(now));
      } catch {
        // Only affects the "last synced" label.
      }
      setState({ status: 'idle', lastSyncAt: now });
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e), dirty: true });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

function scheduleSync(delay = AUTO_DELAY_MS) {
  if (!state.config?.auto) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

function onLocalChange() {
  if (applying || !state.config) return;
  if (!state.dirty) setState({ dirty: true });
  scheduleSync();
}

let started = false;

/** Watches local changes and syncs on start, after changes, and when the tab is hidden or refocused. */
export function startAutoSync() {
  if (started) return;
  started = true;
  for (const name of SYNC_TABLES) {
    const table = db.table(name);
    table.hook('creating', onLocalChange);
    table.hook('updating', onLocalChange);
    table.hook('deleting', onLocalChange);
  }
  document.addEventListener('visibilitychange', () => {
    if (!state.config?.auto) return;
    if (document.visibilityState === 'hidden' && state.dirty) void syncNow();
    // Pick up progress made on another device.
    if (document.visibilityState === 'visible' && Date.now() - (state.lastSyncAt ?? 0) > 60_000) scheduleSync(1000);
  });
  if (state.config?.auto) scheduleSync(1500);
}

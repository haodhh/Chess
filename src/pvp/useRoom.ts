import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl, type RoomView } from './api';

export interface RoomConnection {
  room: RoomView | null;
  you: 'white' | 'black' | null;
  online: boolean;
  /** Server time minus local time, for showing clocks. */
  offset: number;
  error: string | null;
  send: (msg: object) => void;
}

/** Keeps a WebSocket to the room open (reconnecting as needed) and exposes the latest room state. */
export function useRoom(code: string, token: string | null): RoomConnection {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [you, setYou] = useState<'white' | 'black' | null>(null);
  const [online, setOnline] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let retry = 0;
    let timer: number | undefined;

    const connect = () => {
      const socket = new WebSocket(wsUrl(code, token));
      ws.current = socket;
      socket.onopen = () => {
        retry = 0;
        setOnline(true);
      };
      socket.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as
          | { t: 'state'; you: 'white' | 'black'; room: RoomView }
          | { t: 'error'; message: string };
        if (msg.t === 'state') {
          setRoom(msg.room);
          setYou(msg.you);
          setOffset(msg.room.serverNow - Date.now());
          setError(null);
        } else if (msg.t === 'error') {
          setError(msg.message);
        }
      };
      socket.onclose = (e) => {
        setOnline(false);
        if (stopped) return;
        if (e.code === 4000) {
          setError(e.reason || 'Phòng đã đóng.');
          return;
        }
        // Reconnect with backoff: 0.5 s, 1 s, 2 s … up to 10 s.
        timer = window.setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      ws.current?.close();
    };
  }, [code, token]);

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }, []);

  return { room, you, online, offset, error, send };
}

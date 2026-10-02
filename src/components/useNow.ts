import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` so time-based labels (due reviews, "x minutes ago") stay fresh. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

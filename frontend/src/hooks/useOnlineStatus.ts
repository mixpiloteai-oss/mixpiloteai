// ============================================================
// NEUROTEK AI — Online/Offline Detection with Reconnect Logic
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND_HEALTH = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + '/health';
const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;

async function probeBackend(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(BACKEND_HEALTH, { signal: ctrl.signal });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  reconnecting: boolean;
  backendReachable: boolean | null; // null = not yet checked
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const probeTimer = useRef<ReturnType<typeof setInterval>>();

  const handleOnline = useCallback(() => {
    setReconnecting(true);
    reconnectTimer.current = setTimeout(() => {
      setIsOnline(true);
      setWasOffline(true);
      setReconnecting(false);
      setTimeout(() => setWasOffline(false), 4000);
    }, 800);
  }, []);

  const handleOffline = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    setIsOnline(false);
    setReconnecting(false);
    setBackendReachable(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Initial probe + periodic re-check
    probeBackend().then(setBackendReachable);
    probeTimer.current = setInterval(() => {
      if (navigator.onLine) probeBackend().then(setBackendReachable);
    }, PROBE_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimer.current);
      clearInterval(probeTimer.current);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline, reconnecting, backendReachable };
}

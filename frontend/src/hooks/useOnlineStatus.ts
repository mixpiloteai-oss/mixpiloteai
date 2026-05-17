// ============================================================
// NEUROTEK AI — Online/Offline Detection with Reconnect Logic
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  reconnecting: boolean;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleOnline = useCallback(() => {
    setReconnecting(true);
    // Brief delay to confirm stable connection before flagging as back online
    reconnectTimer.current = setTimeout(() => {
      setIsOnline(true);
      setWasOffline(true);
      setReconnecting(false);
      // Reset wasOffline flag after brief display window
      setTimeout(() => setWasOffline(false), 4000);
    }, 800);
  }, []);

  const handleOffline = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    setIsOnline(false);
    setReconnecting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimer.current);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline, reconnecting };
}

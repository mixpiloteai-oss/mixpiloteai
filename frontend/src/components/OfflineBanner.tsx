// ============================================================
// NEUROTEK AI — Offline / Reconnect Banner
// ============================================================
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const { isOnline, wasOffline, reconnecting, backendReachable } = useOnlineStatus();
  const backendDown = isOnline && backendReachable === false;
  const visible = !isOnline || wasOffline || reconnecting || backendDown;

  const bgColor = !isOnline || backendDown
    ? 'rgba(239,68,68,0.12)'
    : wasOffline
    ? 'rgba(16,185,129,0.12)'
    : 'rgba(245,158,11,0.12)';

  const borderColor = !isOnline || backendDown ? 'rgba(239,68,68,0.3)' : wasOffline ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)';
  const textColor = !isOnline || backendDown ? '#ef4444' : wasOffline ? '#10b981' : '#f59e0b';
  const message = reconnecting
    ? 'Reconnecting…'
    : !isOnline
    ? 'You are offline — AI features unavailable'
    : backendDown
    ? 'Backend unreachable — AI features unavailable, DAW works offline'
    : 'Connection restored';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden flex-shrink-0 z-50"
        >
          <div
            className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
            style={{ background: bgColor, borderBottom: `1px solid ${borderColor}`, color: textColor }}
            role="status"
            aria-live="polite"
          >
            {!isOnline || reconnecting ? <WifiOff size={12} /> : <Wifi size={12} />}
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

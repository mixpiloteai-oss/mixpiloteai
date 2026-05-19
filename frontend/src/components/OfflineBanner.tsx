// ─── OfflineBanner — Offline-First Status Bar ─────────────────────────────────
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useNetworkStore } from '../store/networkStore';

export function OfflineBanner() {
  const { isOnline, wasOffline, reconnecting, backendReachable, syncPending, syncing } =
    useNetworkStore();

  const backendDown = isOnline && backendReachable === false;
  const offline     = !isOnline;
  const visible     = offline || wasOffline || reconnecting || backendDown || syncPending > 0;

  let bg     = 'rgba(239,68,68,0.12)';
  let border = 'rgba(239,68,68,0.3)';
  let color  = '#ef4444';
  let msg    = '';
  let icon: React.ReactNode = <WifiOff size={12} />;

  if (reconnecting) {
    bg = 'rgba(245,158,11,0.12)'; border = 'rgba(245,158,11,0.3)'; color = '#f59e0b';
    msg  = 'Reconnecting…';
    icon = <RefreshCw size={12} className="animate-spin" />;
  } else if (syncing) {
    bg = 'rgba(124,58,237,0.12)'; border = 'rgba(124,58,237,0.3)'; color = '#a78bfa';
    msg  = `Syncing ${syncPending} offline change${syncPending !== 1 ? 's' : ''}…`;
    icon = <RefreshCw size={12} className="animate-spin" />;
  } else if (offline) {
    msg = [
      'Offline — DAW works normally',
      'AI + Cloud paused',
      syncPending > 0
        ? `${syncPending} change${syncPending !== 1 ? 's' : ''} queued`
        : 'changes will sync on reconnect',
    ].join(' · ');
  } else if (backendDown) {
    msg = 'Server unreachable — DAW works normally · AI features paused';
  } else if (wasOffline) {
    bg = 'rgba(16,185,129,0.12)'; border = 'rgba(16,185,129,0.3)'; color = '#10b981';
    msg  = syncPending === 0
      ? 'Connection restored — all changes synced'
      : `Connection restored — syncing ${syncPending} change${syncPending !== 1 ? 's' : ''}`;
    icon = <Wifi size={12} />;
  } else if (syncPending > 0) {
    bg = 'rgba(245,158,11,0.08)'; border = 'rgba(245,158,11,0.2)'; color = '#f59e0b';
    msg  = `${syncPending} offline change${syncPending !== 1 ? 's' : ''} pending sync`;
    icon = <RefreshCw size={12} />;
  }

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
            style={{ background: bg, borderBottom: `1px solid ${border}`, color }}
            role="status"
            aria-live="polite"
          >
            {icon}
            {msg}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

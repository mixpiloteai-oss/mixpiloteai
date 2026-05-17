// ============================================================
// NEUROTEK AI — Toast Notification System
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error: <AlertCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info: <Info size={15} />,
};

const COLORS: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: '#10b981', icon: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  error:   { border: '#ef4444', icon: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  warning: { border: '#f59e0b', icon: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  info:    { border: '#7c3aed', icon: '#a78bfa', bg: 'rgba(124,58,237,0.08)' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const duration = toast.duration ?? 4000;
  const colors = COLORS[toast.type];

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(onDismiss, duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 64, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 64, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm shadow-lg max-w-sm w-full"
      style={{
        background: 'rgba(18,18,30,0.97)',
        border: `1px solid ${colors.border}30`,
        backdropFilter: 'blur(12px)',
      }}
      role="alert"
      aria-live="polite"
    >
      <span style={{ color: colors.icon, marginTop: 1, flexShrink: 0 }}>{ICONS[toast.type]}</span>
      <p className="flex-1 text-text-secondary leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        aria-label="Notifications"
      >
        <AnimatePresence mode="sync">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

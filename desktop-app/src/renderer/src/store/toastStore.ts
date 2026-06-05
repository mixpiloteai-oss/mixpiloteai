// ── ToastStore.ts ─────────────────────────────────────────────────────────────
// Global notification queue for the Neurotek Studio DAW.

import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'warn' | 'error'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  durationMs: number
  progress: number   // 0-100 for the auto-dismiss bar
}

interface ToastState {
  toasts: Toast[]
  push(type: ToastType, title: string, message?: string, durationMs?: number): string
  dismiss(id: string): void
  tick(id: string, elapsed: number): void
}

let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push(type, title, message, durationMs = 4000) {
    const id = `toast-${Date.now()}-${++counter}`
    set(s => ({
      toasts: [...s.toasts.slice(-4), { id, type, title, message, durationMs, progress: 100 }],
    }))
    return id
  },

  dismiss(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },

  tick(id, elapsed) {
    set(s => ({
      toasts: s.toasts.map(t =>
        t.id === id
          ? { ...t, progress: Math.max(0, 100 - (elapsed / t.durationMs) * 100) }
          : t
      ).filter(t => t.progress > 0 || t.id !== id),
    }))
  },
}))

// ── Public API ────────────────────────────────────────────────────────────────

export const toast = {
  info:    (title: string, msg?: string, ms?: number) => useToastStore.getState().push('info',    title, msg, ms),
  success: (title: string, msg?: string, ms?: number) => useToastStore.getState().push('success', title, msg, ms),
  warn:    (title: string, msg?: string, ms?: number) => useToastStore.getState().push('warn',    title, msg, ms),
  error:   (title: string, msg?: string, ms?: number) => useToastStore.getState().push('error',   title, msg, ms),
}

/**
 * Shared formatters for the NeuroTek desktop app.
 */

/** Format milliseconds as mm:ss:cc (minutes:seconds:centiseconds) */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const cs  = Math.floor((ms % 1000) / 10)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** Format bars and beats from position (e.g., "003.02.480") */
export function formatBarsBeats(bar: number, beat: number, tick = 0): string {
  return `${String(bar).padStart(3, '0')}.${beat + 1}.${String(tick).padStart(3, '0')}`
}

/** Format file size in human readable */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Format a number with K/M suffix */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Format currency (cents to display) */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Convert dB to linear gain */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

/** Convert linear gain to dB */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 0.000001))
}

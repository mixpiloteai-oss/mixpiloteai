/**
 * Tiny security helpers — no dependencies.
 */

/** Escape `&<>"'` so user-provided text can be rendered as HTML safely. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default:  return ch
    }
  })
}

/**
 * True only for http(s) URLs or relative paths.
 * Rejects `javascript:`, `data:`, `vbscript:`, and other unsafe schemes.
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed === '') return false
  // Relative URL (no scheme)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) === false) return true
  try {
    const u = new URL(trimmed, 'http://x.invalid')
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Redact a token-like string for logs: keep first 6 + ellipsis + last 4. */
export function redactToken(s: string): string {
  if (typeof s !== 'string') return ''
  if (s.length <= 12) return s
  return s.slice(0, 6) + '…' + s.slice(-4)
}

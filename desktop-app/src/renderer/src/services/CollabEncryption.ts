// ─── CollabEncryption ────────────────────────────────────────────────────────
// AES-GCM 256-bit encryption/decryption using Web Crypto API.
// Uses globalThis.crypto.subtle for Node.js 18+ / browser compatibility.

// ── Base64url helpers (pure JS — no atob/btoa for Node compat) ───────────────

export function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  // Convert to base64 using char codes
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let base64 = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0
    const b1 = bytes[i++] ?? 0
    const b2 = bytes[i++] ?? 0
    base64 += chars[b0 >> 2]!
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)]!
    base64 += i - 1 <= bytes.length ? chars[((b1 & 0xf) << 2) | (b2 >> 6)]! : '='
    base64 += i <= bytes.length ? chars[b2 & 0x3f]! : '='
  }
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromBase64url(str: string): ArrayBuffer {
  // Restore base64 padding
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)]! // just to verify
  }
  // Build lookup table
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i
  }

  const byteLength = Math.floor((base64.length * 3) / 4)
  const buf = new Uint8Array(byteLength)
  let bufIdx = 0

  for (let i = 0; i < base64.length; i += 4) {
    const e0 = lookup[base64.charCodeAt(i)] ?? 0
    const e1 = lookup[base64.charCodeAt(i + 1)] ?? 0
    const e2 = lookup[base64.charCodeAt(i + 2)] ?? 0
    const e3 = lookup[base64.charCodeAt(i + 3)] ?? 0

    buf[bufIdx++] = (e0 << 2) | (e1 >> 4)
    if (base64[i + 2] !== '=') buf[bufIdx++] = ((e1 & 0xf) << 4) | (e2 >> 2)
    if (base64[i + 3] !== '=') buf[bufIdx++] = ((e2 & 3) << 6) | e3
  }

  return buf.buffer.slice(0, bufIdx)
}

// ── Key generation ────────────────────────────────────────────────────────────

export async function generateKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // extractable
    ['encrypt', 'decrypt'],
  )
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return globalThis.crypto.subtle.exportKey('raw', key)
}

export async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

export async function encrypt(
  key: CryptoKey,
  data: string,
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data),
  )
  return {
    ciphertext: toBase64url(ciphertextBuf),
    iv: toBase64url(iv.buffer),
  }
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const ivBuf = fromBase64url(iv)
  const ciphertextBuf = fromBase64url(ciphertext)
  const plaintextBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    ciphertextBuf,
  )
  const dec = new TextDecoder()
  return dec.decode(plaintextBuf)
}

// ── Salt generation ───────────────────────────────────────────────────────────

export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(16))
}

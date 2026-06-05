// Verifies the integrity of a downloaded update file using SHA-256.
// Called after electron-updater downloads the update, before install.
// Uses only Node.js built-in crypto — no external packages.

import crypto from 'node:crypto'
import fs from 'node:fs'

export interface IntegrityResult {
  ok:       boolean
  computed: string
  expected: string
  match:    boolean
}

// Compute SHA-256 of a file (synchronous, streams chunks to avoid full-file in RAM).
export function computeFileSHA256(filePath: string): string {
  const hash   = crypto.createHash('sha256')
  const fd     = fs.openSync(filePath, 'r')
  const buf    = Buffer.allocUnsafe(64 * 1024)
  let bytesRead: number
  try {
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.slice(0, bytesRead))
    }
  } finally {
    fs.closeSync(fd)
  }
  return hash.digest('hex')
}

// Verify a downloaded file against an expected SHA-256 hex string.
export function verifyFileIntegrity(filePath: string, expectedSHA256: string): IntegrityResult {
  if (!fs.existsSync(filePath)) {
    return { ok: false, computed: '', expected: expectedSHA256, match: false }
  }
  const computed = computeFileSHA256(filePath)
  const match    = computed.toLowerCase() === expectedSHA256.toLowerCase()
  return { ok: match, computed, expected: expectedSHA256, match }
}

// Verify a Buffer directly (for small in-memory payloads).
export function verifySHA256(data: Buffer, expectedSHA256: string): boolean {
  const computed = crypto.createHash('sha256').update(data).digest('hex')
  return computed.toLowerCase() === expectedSHA256.toLowerCase()
}

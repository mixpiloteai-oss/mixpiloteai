// ─── CollabEncryption.test.ts ─────────────────────────────────────────────────
// node --experimental-strip-types --test

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateKey,
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  toBase64url,
  fromBase64url,
} from '../../src/renderer/src/services/CollabEncryption.ts'

// Skip all tests if Web Crypto is not available (old Node versions)
const hasCrypto = typeof globalThis.crypto?.subtle !== 'undefined'

describe('CollabEncryption', () => {
  it('toBase64url and fromBase64url round-trip', () => {
    const original = new Uint8Array([0, 1, 2, 3, 255, 128, 64, 32, 16, 8, 4])
    const encoded = toBase64url(original.buffer)
    const decoded = new Uint8Array(fromBase64url(encoded))
    assert.equal(decoded.length, original.length)
    for (let i = 0; i < original.length; i++) {
      assert.equal(decoded[i], original[i])
    }
  })

  it('toBase64url produces url-safe characters (no +, /, =)', () => {
    // Use bytes that typically generate +, / in base64
    const data = new Uint8Array([0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe])
    const encoded = toBase64url(data.buffer)
    assert.ok(!encoded.includes('+'), 'should not contain +')
    assert.ok(!encoded.includes('/'), 'should not contain /')
    assert.ok(!encoded.includes('='), 'should not contain =')
  })

  it('SKIP: Web Crypto not available — skipping crypto tests', { skip: !hasCrypto }, async () => {
    // This test is a placeholder — actual tests below are guarded by skip
  })

  it('generateKey returns a CryptoKey with type secret', { skip: !hasCrypto }, async () => {
    const key = await generateKey()
    assert.equal(key.type, 'secret')
    assert.ok(key.algorithm)
    assert.equal((key.algorithm as { name: string }).name, 'AES-GCM')
  })

  it('encrypt returns non-empty ciphertext and iv', { skip: !hasCrypto }, async () => {
    const key = await generateKey()
    const result = await encrypt(key, 'Hello, world!')
    assert.ok(typeof result.ciphertext === 'string')
    assert.ok(typeof result.iv === 'string')
    assert.ok(result.ciphertext.length > 0)
    assert.ok(result.iv.length > 0)
  })

  it('decrypt round-trips to original text', { skip: !hasCrypto }, async () => {
    const key = await generateKey()
    const original = 'Secret audio project data 🎵'
    const { ciphertext, iv } = await encrypt(key, original)
    const decrypted = await decrypt(key, ciphertext, iv)
    assert.equal(decrypted, original)
  })

  it('encrypt produces different ciphertext each time (different IV)', { skip: !hasCrypto }, async () => {
    const key = await generateKey()
    const text = 'same text'
    const r1 = await encrypt(key, text)
    const r2 = await encrypt(key, text)
    // IVs should differ (random 12 bytes)
    assert.notEqual(r1.iv, r2.iv)
    // Ciphertexts should differ too
    assert.notEqual(r1.ciphertext, r2.ciphertext)
  })

  it('deriveKey returns a CryptoKey', { skip: !hasCrypto }, async () => {
    const salt = generateSalt()
    const key = await deriveKey('my-password', salt)
    assert.equal(key.type, 'secret')
    assert.equal((key.algorithm as { name: string }).name, 'AES-GCM')
  })

  it('two deriveKey calls with same password+salt produce equivalent keys', { skip: !hasCrypto }, async () => {
    const salt = generateSalt()
    const key1 = await deriveKey('password123', salt)
    const key2 = await deriveKey('password123', salt)

    // Encrypt with key1, decrypt with key2
    const text = 'deterministic test'
    const { ciphertext, iv } = await encrypt(key1, text)
    const decrypted = await decrypt(key2, ciphertext, iv)
    assert.equal(decrypted, text)
  })

  it('generateSalt returns 16-byte Uint8Array', () => {
    const salt = generateSalt()
    assert.ok(salt instanceof Uint8Array)
    assert.equal(salt.length, 16)
  })
})

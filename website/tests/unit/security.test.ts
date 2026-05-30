import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs } from '../setup/browser-stub.ts'

installBrowserStubs()

import { escapeHtml, isSafeUrl, redactToken } from '../../src/lib/security.ts'

// ── escapeHtml ──────────────────────────────────────────────────

test('escapeHtml: escapes <script> tag', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;')
})

test('escapeHtml: escapes all five chars (& < > " \')', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;')
})

test('escapeHtml: leaves safe characters alone', () => {
  const safe = 'Hello world 123 — abc_def.ghi'
  assert.equal(escapeHtml(safe), safe)
})

test('escapeHtml: escapes ampersand first to avoid double-encoding', () => {
  // & must become &amp; even when followed by other escapable chars
  assert.equal(escapeHtml('& <'), '&amp; &lt;')
})

test('escapeHtml: handles empty string', () => {
  assert.equal(escapeHtml(''), '')
})

test('escapeHtml: handles multiple occurrences', () => {
  assert.equal(escapeHtml('<<>>'), '&lt;&lt;&gt;&gt;')
})

test('escapeHtml: handles realistic XSS payload', () => {
  const payload = `<img src=x onerror="alert('xss')">`
  const out = escapeHtml(payload)
  assert.ok(!out.includes('<'))
  assert.ok(!out.includes('>'))
  assert.ok(!out.includes('"'))
  assert.ok(out.includes('&lt;'))
  assert.ok(out.includes('&quot;'))
})

// ── isSafeUrl ──────────────────────────────────────────────────

test('isSafeUrl: accepts https URL', () => {
  assert.equal(isSafeUrl('https://example.com'), true)
})

test('isSafeUrl: accepts http URL', () => {
  assert.equal(isSafeUrl('http://example.com'), true)
})

test('isSafeUrl: accepts relative path', () => {
  assert.equal(isSafeUrl('/relative/path'), true)
})

test('isSafeUrl: accepts query-only relative URL', () => {
  assert.equal(isSafeUrl('?q=1'), true)
})

test('isSafeUrl: rejects javascript: scheme', () => {
  assert.equal(isSafeUrl('javascript:alert(1)'), false)
})

test('isSafeUrl: rejects javascript: with whitespace', () => {
  assert.equal(isSafeUrl('  javascript:alert(1)  '), false)
})

test('isSafeUrl: rejects data: URL', () => {
  assert.equal(isSafeUrl('data:text/html,<script>'), false)
})

test('isSafeUrl: rejects vbscript:', () => {
  assert.equal(isSafeUrl('vbscript:msgbox'), false)
})

test('isSafeUrl: rejects file: URL', () => {
  assert.equal(isSafeUrl('file:///etc/passwd'), false)
})

test('isSafeUrl: rejects empty string', () => {
  assert.equal(isSafeUrl(''), false)
})

test('isSafeUrl: rejects whitespace-only string', () => {
  assert.equal(isSafeUrl('   '), false)
})

test('isSafeUrl: rejects non-string input', () => {
  // @ts-expect-error — runtime behavior under bad input
  assert.equal(isSafeUrl(null), false)
  // @ts-expect-error
  assert.equal(isSafeUrl(undefined), false)
  // @ts-expect-error
  assert.equal(isSafeUrl(123), false)
})

test('isSafeUrl: protocol-relative // is treated as relative (no scheme matched)', () => {
  // The function regex looks for `<scheme>:` — // has no scheme, so it returns true.
  // This documents (not endorses) current behavior.
  assert.equal(isSafeUrl('//evil.example'), true)
})

// ── redactToken ────────────────────────────────────────────────

test('redactToken: redacts long token, keeps first 6 + last 4', () => {
  const out = redactToken('abcdefghijklmnop')
  assert.ok(out.includes('…'), 'must contain ellipsis')
  assert.ok(out.startsWith('abcdef'), `should start with abcdef, got ${out}`)
  assert.ok(out.endsWith('mnop'), `should end with mnop, got ${out}`)
  assert.equal(out, 'abcdef…mnop')
})

test('redactToken: short (≤ 12 chars) returned unchanged', () => {
  assert.equal(redactToken('short'), 'short')
  assert.equal(redactToken('abcdefghijkl'), 'abcdefghijkl') // exactly 12
})

test('redactToken: 13 chars triggers redaction', () => {
  const out = redactToken('abcdefghijklm')
  assert.equal(out, 'abcdef…jklm')
})

test('redactToken: non-string returns empty string', () => {
  // @ts-expect-error
  assert.equal(redactToken(null), '')
  // @ts-expect-error
  assert.equal(redactToken(undefined), '')
  // @ts-expect-error
  assert.equal(redactToken(12345), '')
})

test('redactToken: empty string returned unchanged (length 0 ≤ 12)', () => {
  assert.equal(redactToken(''), '')
})

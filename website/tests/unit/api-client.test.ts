import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  installBrowserStubs,
  setMockFetch,
  resetMocks,
  getLocation,
  makeResponse,
  recordingFetch,
  makeJwt,
} from '../setup/browser-stub.ts'

installBrowserStubs()

import {
  authTokens,
  apiGet,
  apiPost,
  login,
  register,
  logout,
  ApiError,
  BASE_URL,
} from '../../src/lib/api.ts'

// ── authTokens ────────────────────────────────────────────────

test('authTokens.set + get round-trips an opaque token', () => {
  resetMocks()
  authTokens.set('opaque-token')
  assert.equal(authTokens.get(), 'opaque-token')
})

test('authTokens.clear removes token, refresh, and exp', () => {
  resetMocks()
  authTokens.set(makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  authTokens.setRefresh('refresh-x')
  assert.ok(authTokens.get())
  assert.ok(authTokens.getRefresh())
  assert.ok(authTokens.getExp() !== null)

  authTokens.clear()
  assert.equal(authTokens.get(), null)
  assert.equal(authTokens.getRefresh(), null)
  assert.equal(authTokens.getExp(), null)
  assert.equal(localStorage.getItem('auth-token-exp'), null)
})

test('authTokens.isLoggedIn reflects token presence', () => {
  resetMocks()
  assert.equal(authTokens.isLoggedIn(), false)
  authTokens.set('t')
  assert.equal(authTokens.isLoggedIn(), true)
  authTokens.clear()
  assert.equal(authTokens.isLoggedIn(), false)
})

test('authTokens.set with valid JWT stores exp from payload', () => {
  resetMocks()
  const futureExp = Math.floor(Date.now() / 1000) + 7200
  const jwt = makeJwt({ exp: futureExp, sub: 'u1' })
  authTokens.set(jwt)
  assert.equal(authTokens.getExp(), futureExp)
  assert.equal(localStorage.getItem('auth-token-exp'), String(futureExp))
})

test('authTokens.set with malformed token does NOT crash and does NOT set exp', () => {
  resetMocks()
  // Pre-seed a stale exp to confirm it gets cleared
  localStorage.setItem('auth-token-exp', '9999999999')
  authTokens.set('not-a-jwt')
  assert.equal(authTokens.get(), 'not-a-jwt')
  assert.equal(authTokens.getExp(), null, 'stale exp should be cleared')
})

test('authTokens.set with JWT missing exp claim clears stale exp', () => {
  resetMocks()
  localStorage.setItem('auth-token-exp', '1234567890')
  const jwt = makeJwt({ sub: 'no-exp' })
  authTokens.set(jwt)
  assert.equal(authTokens.getExp(), null)
})

test('authTokens.set with JWT having non-number exp clears stale exp', () => {
  resetMocks()
  localStorage.setItem('auth-token-exp', '1234567890')
  const jwt = makeJwt({ exp: 'soon' })
  authTokens.set(jwt)
  assert.equal(authTokens.getExp(), null)
})

test('authTokens.getExp returns null when storage holds garbage', () => {
  resetMocks()
  localStorage.setItem('auth-token-exp', 'not-a-number')
  assert.equal(authTokens.getExp(), null)
})

// ── apiGet / apiPost happy path ───────────────────────────────

test('apiGet hits BASE_URL + path with Authorization when token present', async () => {
  resetMocks()
  authTokens.set('opaque-token')
  const rec = recordingFetch(() => makeResponse({ json: { ok: true } }))
  setMockFetch(rec.fn)

  const out = await apiGet<{ ok: boolean }>('/api/auth/me')
  assert.deepEqual(out, { ok: true })
  assert.equal(rec.calls.length, 1)
  assert.equal(rec.calls[0]!.input, `${BASE_URL}/api/auth/me`)
  assert.equal(rec.calls[0]!.init.method, 'GET')
  assert.equal((rec.calls[0]!.init.headers as any).Authorization, 'Bearer opaque-token')
  assert.equal((rec.calls[0]!.init.headers as any)['Content-Type'], 'application/json')
})

test('apiGet omits Authorization when no token', async () => {
  resetMocks()
  const rec = recordingFetch(() => makeResponse({ json: { ok: true } }))
  setMockFetch(rec.fn)
  await apiGet('/api/public')
  assert.equal((rec.calls[0]!.init.headers as any).Authorization, undefined)
})

test('apiPost serializes body and sets POST method', async () => {
  resetMocks()
  const rec = recordingFetch(() => makeResponse({ json: { ok: true } }))
  setMockFetch(rec.fn)
  await apiPost('/api/x', { hello: 'world' })
  assert.equal(rec.calls[0]!.init.method, 'POST')
  assert.equal(rec.calls[0]!.init.body, JSON.stringify({ hello: 'world' }))
})

// ── error parsing ─────────────────────────────────────────────

test('non-401 error throws ApiError with parsed body.error', async () => {
  resetMocks()
  setMockFetch(async () => makeResponse({ status: 400, json: { error: 'bad input', code: 'E_BAD' } }))
  await assert.rejects(() => apiGet('/api/x'), (e: any) => {
    assert.ok(e instanceof ApiError)
    assert.equal(e.status, 400)
    assert.equal(e.message, 'bad input')
    assert.equal(e.code, 'E_BAD')
    return true
  })
})

test('non-401 error falls back to body.message then HTTP status', async () => {
  resetMocks()
  setMockFetch(async () => makeResponse({ status: 500, json: {} }))
  await assert.rejects(() => apiGet('/api/x'), (e: any) => {
    assert.equal(e.status, 500)
    assert.equal(e.message, 'HTTP 500')
    return true
  })
})

// ── 401 + refresh flow ────────────────────────────────────────

test('401 → no refresh token → clear + redirect to #/login + throw 401', async () => {
  resetMocks()
  authTokens.set('expired-token')
  // no refresh token set
  setMockFetch(async () => makeResponse({ status: 401, json: { error: 'expired' } }))

  await assert.rejects(() => apiGet('/api/auth/me'), (e: any) => {
    assert.ok(e instanceof ApiError)
    assert.equal(e.status, 401)
    return true
  })
  assert.equal(authTokens.get(), null, 'tokens cleared')
  assert.equal(getLocation().hash, '#/login', 'redirected to login')
})

test('401 → refresh succeeds → original request retried with new token', async () => {
  resetMocks()
  authTokens.set('old-token')
  authTokens.setRefresh('refresh-abc')

  const newJwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  const calls: string[] = []
  setMockFetch(async (input: any, init: any) => {
    calls.push(String(input))
    if (String(input).endsWith('/api/auth/refresh')) {
      return makeResponse({ json: { data: { accessToken: newJwt } } })
    }
    // First /api/me call comes with old-token (401), second with new
    const auth = init?.headers?.Authorization ?? ''
    if (auth === 'Bearer old-token') {
      return makeResponse({ status: 401, json: { error: 'expired' } })
    }
    return makeResponse({ json: { data: { me: true } } })
  })

  const out = await apiGet<{ data: { me: boolean } }>('/api/auth/me')
  assert.deepEqual(out, { data: { me: true } })
  assert.equal(authTokens.get(), newJwt, 'token replaced')
  assert.equal(calls.length, 3, 'me(401) → refresh → me(200)')
  assert.ok(calls[0]!.endsWith('/api/auth/me'))
  assert.ok(calls[1]!.endsWith('/api/auth/refresh'))
  assert.ok(calls[2]!.endsWith('/api/auth/me'))
})

test('401 → refresh ALSO 401 → clear + redirect + throw', async () => {
  resetMocks()
  authTokens.set('old')
  authTokens.setRefresh('refresh-x')
  setMockFetch(async (input: any) => {
    if (String(input).endsWith('/api/auth/refresh')) {
      return makeResponse({ status: 401, json: {} })
    }
    return makeResponse({ status: 401, json: {} })
  })

  await assert.rejects(() => apiGet('/api/auth/me'), (e: any) => e instanceof ApiError && e.status === 401)
  assert.equal(authTokens.get(), null)
  assert.equal(authTokens.getRefresh(), null)
  assert.equal(getLocation().hash, '#/login')
})

test('proactive refresh: token expiring within 30s triggers refresh before request', async () => {
  resetMocks()
  // Token already near expiry — exp claim is now+10s
  const nearExp = Math.floor(Date.now() / 1000) + 10
  const oldJwt = makeJwt({ exp: nearExp })
  authTokens.set(oldJwt)
  authTokens.setRefresh('refresh-y')

  const freshJwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  const calls: string[] = []
  setMockFetch(async (input: any) => {
    calls.push(String(input))
    if (String(input).endsWith('/api/auth/refresh')) {
      return makeResponse({ json: { data: { accessToken: freshJwt } } })
    }
    return makeResponse({ json: { ok: true } })
  })

  await apiGet('/api/data')
  assert.equal(calls[0], `${BASE_URL}/api/auth/refresh`, 'refresh fires before main request')
  assert.equal(calls[1], `${BASE_URL}/api/data`)
  assert.equal(authTokens.get(), freshJwt)
})

// ── login / register / logout ─────────────────────────────────

test('login: stores access + refresh tokens and returns data', async () => {
  resetMocks()
  const access = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  setMockFetch(async () =>
    makeResponse({
      json: {
        success: true,
        data: {
          accessToken: access,
          refreshToken: 'refresh-zzz',
          user: { id: 'u', email: 'a@b.c', name: 'A', plan: 'free' },
        },
      },
    }),
  )

  const out = await login('a@b.c', 'pw')
  assert.equal(out.user.email, 'a@b.c')
  assert.equal(authTokens.get(), access)
  assert.equal(authTokens.getRefresh(), 'refresh-zzz')
})

test('register: stores tokens and returns data', async () => {
  resetMocks()
  const access = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  setMockFetch(async () =>
    makeResponse({
      json: {
        success: true,
        data: {
          accessToken: access,
          refreshToken: 'r2',
          user: { id: 'u2', email: 'b@b.c', name: 'B', plan: 'free' },
        },
      },
    }),
  )

  await register('B', 'b@b.c', 'pw')
  assert.equal(authTokens.get(), access)
  assert.equal(authTokens.getRefresh(), 'r2')
})

test('logout clears all auth keys', () => {
  resetMocks()
  authTokens.set(makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  authTokens.setRefresh('r')
  logout()
  assert.equal(authTokens.get(), null)
  assert.equal(authTokens.getRefresh(), null)
  assert.equal(authTokens.getExp(), null)
})

test('ApiError carries status, message, optional code', () => {
  const e = new ApiError(418, 'teapot', 'E_TEAPOT')
  assert.equal(e.status, 418)
  assert.equal(e.message, 'teapot')
  assert.equal(e.code, 'E_TEAPOT')
  assert.equal(e.name, 'ApiError')
  assert.ok(e instanceof Error)
})

test('BASE_URL exported and falls back to production', () => {
  assert.equal(BASE_URL, 'https://mixpiloteai-production.up.railway.app')
})

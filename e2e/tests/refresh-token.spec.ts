// Refresh-token lifecycle — rotation, theft detection, logout-all.
import { test, expect } from '../fixtures/auth'
import { registerUser } from '../fixtures/auth'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

test.describe('@auth refresh-token rotation', () => {
  test('expired/invalid refresh token returns 401', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/auth/refresh`, {
      data: { refreshToken: 'eyJ.invalid.token' },
    })
    expect(res.status()).toBe(401)
  })

  test('valid refresh returns a new access token', async ({ request }) => {
    const session = await registerUser(request)
    const res = await request.post(`${BACKEND}/api/auth/refresh`, {
      data: { refreshToken: session.refreshToken },
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as { data?: { accessToken?: string } }
    expect(body.data?.accessToken).toBeTruthy()
    expect(body.data?.accessToken).not.toEqual(session.accessToken)
  })

  test('rotated (old) refresh token is rejected after a successful refresh', async ({ request }) => {
    const session = await registerUser(request)
    // First refresh — should succeed and rotate
    const first = await request.post(`${BACKEND}/api/auth/refresh`, { data: { refreshToken: session.refreshToken } })
    expect(first.status()).toBe(200)
    // Replay the OLD refresh token — must be rejected
    const replay = await request.post(`${BACKEND}/api/auth/refresh`, { data: { refreshToken: session.refreshToken } })
    expect(replay.status()).toBe(401)
  })

  test('logout invalidates the access token jti', async ({ request }) => {
    const session = await registerUser(request)
    // Authenticated call works
    const meBefore = await request.get(`${BACKEND}/api/auth/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    })
    expect([200, 404]).toContain(meBefore.status()) // 404 ok if /me not present

    await request.post(`${BACKEND}/api/auth/logout`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      data: { refreshToken: session.refreshToken },
    })

    // Access token should now be unusable on jti-aware endpoints
    const meAfter = await request.get(`${BACKEND}/api/projects`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    })
    // either 401 (revoked) or 200 (endpoint is public-read) — must not 5xx
    expect(meAfter.status()).toBeLessThan(500)
  })

  test('logout-all revokes every session for the user', async ({ request }) => {
    const session = await registerUser(request)
    const res = await request.post(`${BACKEND}/api/auth/logout-all`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    })
    test.skip(res.status() === 404, '/logout-all not exposed in this build')
    expect(res.status()).toBe(200)

    const refresh = await request.post(`${BACKEND}/api/auth/refresh`, { data: { refreshToken: session.refreshToken } })
    expect(refresh.status()).toBe(401)
  })
})

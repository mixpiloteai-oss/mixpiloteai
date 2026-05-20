import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs, resetMocks } from '../setup/browser-stub.ts'

// Install stubs BEFORE importing the SUT — adminApi reads localStorage at call time
installBrowserStubs()

import { adminToken, isAdminAuthed } from '../../src/pages/Admin/services/adminApi.ts'

describe('adminToken', () => {
  beforeEach(() => {
    resetMocks()
  })

  test('get() returns null when nothing is stored', () => {
    assert.equal(adminToken.get(), null)
  })

  test('set() then get() returns the token', () => {
    adminToken.set('my-access-token')
    assert.equal(adminToken.get(), 'my-access-token')
  })

  test('clear() removes access and refresh tokens', () => {
    adminToken.set('access-tok')
    adminToken.setRefresh('refresh-tok')
    assert.equal(adminToken.get(), 'access-tok')
    assert.equal(adminToken.getRefresh(), 'refresh-tok')
    adminToken.clear()
    assert.equal(adminToken.get(), null)
    assert.equal(adminToken.getRefresh(), null)
  })

  test('setRefresh() then getRefresh() returns the refresh token', () => {
    adminToken.setRefresh('my-refresh-token')
    assert.equal(adminToken.getRefresh(), 'my-refresh-token')
  })

  test('clear() after no tokens set is a no-op', () => {
    // should not throw
    adminToken.clear()
    assert.equal(adminToken.get(), null)
  })
})

describe('isAdminAuthed()', () => {
  beforeEach(() => {
    resetMocks()
  })

  test('returns false when no token and no admin-key', () => {
    assert.equal(isAdminAuthed(), false)
  })

  test('returns true after adminToken.set()', () => {
    adminToken.set('some-valid-token')
    assert.equal(isAdminAuthed(), true)
  })

  test('returns true when admin-key is stored in localStorage', () => {
    localStorage.setItem('admin-key', 'nt-admin-dev-2025')
    assert.equal(isAdminAuthed(), true)
  })

  test('returns false after adminToken.clear() removes all auth state', () => {
    adminToken.set('tok')
    adminToken.clear()
    // admin-key might still be there if set externally — clear it too
    localStorage.removeItem('admin-key')
    assert.equal(isAdminAuthed(), false)
  })
})

describe('inactivity timeout detection', () => {
  beforeEach(() => {
    resetMocks()
  })

  test('stale last-activity timestamp — isAdminAuthed still true (only adminFetch checks inactivity)', () => {
    // isAdminAuthed() only checks for the presence of a token, NOT inactivity.
    // Inactivity is checked inside adminFetch(). We verify this design is correct here.
    adminToken.set('tok')
    const old = Date.now() - 31 * 60 * 1000
    localStorage.setItem('admin-last-activity', String(old))
    // isAdminAuthed() should still return true — it is token presence only
    assert.equal(isAdminAuthed(), true)
  })

  test('no last-activity timestamp → isAdminAuthed unaffected', () => {
    adminToken.set('tok')
    localStorage.removeItem('admin-last-activity')
    assert.equal(isAdminAuthed(), true)
  })
})

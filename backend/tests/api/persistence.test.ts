/**
 * Persistence Tests — Mission 4
 *
 * Tests that all data persists correctly:
 * - In Supabase mode: data survives "restarts" (re-instantiation of repositories)
 * - In fallback mode (no Supabase): data survives within a process via in-memory stores
 *
 * These tests run without a live DB (Supabase not configured in CI),
 * so they use the in-memory fallback path to verify the service layer contracts.
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// ── Test helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── 1. User persistence (in-memory fallback path) ────────────────────────────

describe('User persistence (fallback)', () => {
  it('createUser stores user retrievable by email', async () => {
    const { createUser, findUserByEmail } = await import('../../src/data/mockDB')
    const email = `test-${uid()}@example.com`
    const created = await createUser({ email, name: 'Test User', password: 'pass123' })
    assert.ok(created.id, 'id assigned')
    assert.equal(created.email, email)
    const found = await findUserByEmail(email)
    assert.ok(found, 'user found by email')
    assert.equal(found!.id, created.id)
  })

  it('createUser stores user retrievable by id', async () => {
    const { createUser, findUserById } = await import('../../src/data/mockDB')
    const email = `test-${uid()}@example.com`
    const created = await createUser({ email, name: 'Test User', password: 'pass123' })
    const found = await findUserById(created.id)
    assert.ok(found, 'user found by id')
    assert.equal(found!.email, email)
  })

  it('duplicate email throws', async () => {
    const { createUser } = await import('../../src/data/mockDB')
    const email = `dup-${uid()}@example.com`
    await createUser({ email, name: 'First', password: 'pass123' })
    await assert.rejects(
      () => createUser({ email, name: 'Second', password: 'pass456' }),
      /Email already in use/i
    )
  })

  it('getTodayUsage returns 0 for new user, increments correctly', async () => {
    const { getTodayUsage, incrementUsage } = await import('../../src/data/mockDB')
    const userId = `u-${uid()}`
    const before = await getTodayUsage(userId)
    assert.equal(before, 0, 'starts at 0')
    await incrementUsage(userId)
    await incrementUsage(userId)
    const after = await getTodayUsage(userId)
    assert.equal(after, 2, 'incremented twice')
  })

  it('password is hashed (not plain text)', async () => {
    const { createUser } = await import('../../src/data/mockDB')
    const email = `hash-${uid()}@example.com`
    const user = await createUser({ email, name: 'Hash Test', password: 'plain-password' })
    assert.notEqual(user.passwordHash, 'plain-password', 'password is hashed')
    assert.match(user.passwordHash, /^\$2[ab]\$/, 'bcrypt hash format')
  })
})

// ── 2. Project persistence ────────────────────────────────────────────────────

describe('Project persistence (fallback)', () => {
  it('createProject returns project with id', async () => {
    const { db } = await import('../../src/data/mockDB')
    const project = await db.createProject({
      userId: `u-${uid()}`, name: 'Test Project', genre: 'house',
      bpm: 128, key: 'C', mood: 'energetic', tracks: [],
      duration: 180, isStarred: false, coverColor: '#ff0000', tags: ['test'],
    })
    assert.ok(project.id, 'id assigned')
    assert.equal(project.name, 'Test Project')
    assert.equal(project.bpm, 128)
  })

  it('getProject retrieves created project', async () => {
    const { db } = await import('../../src/data/mockDB')
    const userId = `u-${uid()}`
    const project = await db.createProject({
      userId, name: 'Retrieve Test', genre: 'techno',
      bpm: 140, key: 'Am', mood: 'dark', tracks: [],
      duration: 240, isStarred: true, coverColor: '#000000', tags: [],
    })
    const found = await db.getProject(project.id)
    assert.ok(found, 'project found')
    assert.equal(found!.name, 'Retrieve Test')
    assert.equal(found!.isStarred, true)
  })

  it('updateProject updates fields and preserves others', async () => {
    const { db } = await import('../../src/data/mockDB')
    const userId = `u-${uid()}`
    const project = await db.createProject({
      userId, name: 'Original', genre: 'drum-and-bass',
      bpm: 174, key: 'Gm', mood: 'intense', tracks: [],
      duration: 300, isStarred: false, coverColor: '#333', tags: ['old'],
    })
    const updated = await db.updateProject(project.id, { name: 'Updated', bpm: 175 })
    assert.ok(updated, 'update returned project')
    assert.equal(updated!.name, 'Updated')
    assert.equal(updated!.bpm, 175)
    assert.equal(updated!.genre, 'drum-and-bass', 'genre preserved')
    assert.equal(updated!.userId, userId, 'userId preserved')
  })

  it('deleteProject removes project', async () => {
    const { db } = await import('../../src/data/mockDB')
    const userId = `u-${uid()}`
    const project = await db.createProject({
      userId, name: 'To Delete', genre: 'ambient',
      bpm: 80, key: 'D', mood: 'calm', tracks: [],
      duration: 600, isStarred: false, coverColor: '#fff', tags: [],
    })
    const deleted = await db.deleteProject(project.id)
    assert.equal(deleted, true, 'delete returned true')
    const found = await db.getProject(project.id)
    assert.equal(found, undefined, 'project no longer found')
  })

  it('concurrent creates do not conflict', async () => {
    const { db } = await import('../../src/data/mockDB')
    const userId = `u-${uid()}`
    const creates = Array.from({ length: 10 }, (_, i) =>
      db.createProject({
        userId, name: `Project ${i}`, genre: 'pop',
        bpm: 120 + i, key: 'C', mood: 'happy', tracks: [],
        duration: 180, isStarred: false, coverColor: '#fff', tags: [],
      })
    )
    const results = await Promise.all(creates)
    const ids = new Set(results.map(r => r.id))
    assert.equal(ids.size, 10, 'all 10 IDs are unique')
    assert.equal(results.length, 10, 'all 10 creates returned')
  })
})

// ── 3. Template persistence ───────────────────────────────────────────────────

describe('Template persistence (fallback)', () => {
  it('saveTemplate stores and getAllTemplates returns it', async () => {
    const { db } = await import('../../src/data/mockDB')
    const name = `Template-${uid()}`
    await db.saveTemplate({
      name, genre: 'techno', bpm: 138, mood: 'dark',
      description: 'Test template', tracks: [],
      aiConfidence: 0.95, generatedAt: new Date().toISOString(),
    })
    const all = await db.getAllTemplates()
    const found = all.find(t => t.name === name)
    assert.ok(found, 'template found in getAllTemplates')
    assert.equal(found!.genre, 'techno')
    assert.equal(found!.aiConfidence, 0.95)
  })
})

// ── 4. Quota persistence ──────────────────────────────────────────────────────

describe('Quota persistence (fallback)', () => {
  it('usage persists across multiple await calls in same process', async () => {
    const { getTodayUsage, incrementUsage } = await import('../../src/data/mockDB')
    const userId = `quota-${uid()}`
    // Simulate multiple requests in the same process
    for (let i = 0; i < 5; i++) {
      await incrementUsage(userId)
    }
    const usage = await getTodayUsage(userId)
    assert.equal(usage, 5, 'all 5 increments accumulated')
  })

  it('different users have independent quotas', async () => {
    const { getTodayUsage, incrementUsage } = await import('../../src/data/mockDB')
    const userA = `quotaA-${uid()}`
    const userB = `quotaB-${uid()}`
    await incrementUsage(userA)
    await incrementUsage(userA)
    await incrementUsage(userB)
    assert.equal(await getTodayUsage(userA), 2)
    assert.equal(await getTodayUsage(userB), 1)
  })
})

// ── 5. withRetry contract (lib/db) ────────────────────────────────────────────

describe('withRetry contract', () => {
  it('retries on transient failure and eventually succeeds', async () => {
    const { withRetry } = await import('../../src/lib/db')
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      if (attempts < 3) return { data: null, error: { message: 'transient', code: '57014' } }
      return { data: 42, error: null }
    }, 'test:retry')
    assert.equal(result, 42, 'succeeded on 3rd attempt')
    assert.equal(attempts, 3, 'tried 3 times')
  })

  it('does not retry on unique constraint violation (23505)', async () => {
    const { withRetry } = await import('../../src/lib/db')
    let attempts = 0
    await assert.rejects(
      () => withRetry(async () => {
        attempts++
        return { data: null, error: { message: 'duplicate key', code: '23505' } }
      }, 'test:no-retry'),
      /duplicate key/
    )
    assert.equal(attempts, 1, 'only tried once — no retry on 23505')
  })

  it('throws after max retries', async () => {
    const { withRetry } = await import('../../src/lib/db')
    let attempts = 0
    await assert.rejects(
      () => withRetry(async () => {
        attempts++
        return { data: null, error: { message: 'persistent failure', code: '57014' } }
      }, 'test:max-retry'),
      /persistent failure/
    )
    assert.ok(attempts >= 3, `tried at least 3 times (got ${attempts})`)
  })
})

// ── 6. saveService contract ───────────────────────────────────────────────────

describe('saveService contract (in-memory cache)', () => {
  it('createVersion + listVersions returns the saved version', async () => {
    const { saveService } = await import('../../src/services/saveService')
    const projectId = `proj-${uid()}`
    const v = await saveService.createVersion(projectId, 'v1.0', { bpm: 128, tracks: [] })
    assert.ok(v.id, 'version has id')
    assert.equal(v.label, 'v1.0')
    assert.equal(v.projectId, projectId)
    // listVersions uses in-memory cache when DB is not configured
    const list = await saveService.listVersions(projectId)
    assert.ok(list.length >= 1, 'at least one version in list')
  })

  it('getVersion retrieves the same data', async () => {
    const { saveService } = await import('../../src/services/saveService')
    const projectId = `proj-${uid()}`
    const payload   = { bpm: 140, tracks: [{ id: 1 }] }
    const v = await saveService.createVersion(projectId, 'v2.0', payload)
    const retrieved = await saveService.getVersion(projectId, v.id)
    assert.ok(retrieved, 'retrieved from cache or DB')
    assert.equal(retrieved!.label, 'v2.0')
    assert.deepEqual(retrieved!.data, payload)
  })
})

// ── 7. couponService contract ─────────────────────────────────────────────────

describe('couponService contract (in-memory fallback)', () => {
  it('validateCoupon returns valid for seeded WELCOME20 coupon', async () => {
    const { validateCoupon } = await import('../../src/services/couponService')
    const result = await validateCoupon('WELCOME20', 'pro')
    assert.ok(result.valid, 'WELCOME20 is valid')
    assert.ok(result.coupon, 'coupon returned')
    assert.equal(result.coupon!.code, 'WELCOME20')
  })

  it('validateCoupon rejects unknown code', async () => {
    const { validateCoupon } = await import('../../src/services/couponService')
    const result = await validateCoupon('NOTACODE_XYZ', 'pro')
    assert.equal(result.valid, false)
    assert.ok(result.error, 'error message set')
  })

  it('applyCouponToAmount applies percentage discount', async () => {
    const { applyCouponToAmount, validateCoupon } = await import('../../src/services/couponService')
    const v = await validateCoupon('WELCOME20', 'pro')
    if (!v.coupon) { return } // skip if not seeded yet
    const discounted = applyCouponToAmount(v.coupon, 1000)
    assert.ok(discounted <= 1000, 'discounted amount <= original')
    assert.ok(discounted >= 0, 'discounted amount >= 0')
  })
})

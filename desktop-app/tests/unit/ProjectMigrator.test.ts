import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  migrateToLatest,
  isMigrationError,
} from '../../src/renderer/src/audio/save/ProjectMigrator.ts'

// ─── migrateToLatest ──────────────────────────────────────────────────────────

describe('ProjectMigrator / v1 data (no migration needed)', () => {
  it('returns didMigrate=false for already-v1 data', () => {
    const v1Data = {
      version:    1,
      savedAt:    Date.now(),
      appVersion: '1.0.0',
      project:    null,
      mixer:      null,
      transport:  null,
      pianoRoll:  null,
      midi:       null,
    }
    const result = migrateToLatest(v1Data)
    assert.ok(!isMigrationError(result))
    if (!isMigrationError(result)) {
      assert.equal(result.didMigrate, false)
      assert.equal(result.fromVersion, 1)
      assert.equal(result.toVersion, 1)
    }
  })
})

describe('ProjectMigrator / v0 data (migration needed)', () => {
  it('migrates v0 (no version field) to v1', () => {
    const v0Data = {
      savedAt:    1000000,
      appVersion: '0.9.0',
      project:    { name: 'Old Project' },
    }
    const result = migrateToLatest(v0Data)
    assert.ok(!isMigrationError(result), 'should not be a migration error')
    if (!isMigrationError(result)) {
      assert.equal(result.didMigrate, true)
      assert.equal(result.fromVersion, 0)
      assert.equal(result.toVersion, 1)
      const migrated = result.data as Record<string, unknown>
      assert.equal(migrated.version, 1)
    }
  })

  it('adds missing sections as null for v0 data', () => {
    const v0Data = {
      savedAt: 1000000,
      project: { name: 'Old Project' },
    }
    const result = migrateToLatest(v0Data)
    assert.ok(!isMigrationError(result))
    if (!isMigrationError(result)) {
      const migrated = result.data as Record<string, unknown>
      assert.equal(migrated.mixer, null)
      assert.equal(migrated.transport, null)
      assert.equal(migrated.pianoRoll, null)
      assert.equal(migrated.midi, null)
    }
  })

  it('preserves existing project/transport/mixer sections during v0 migration', () => {
    const v0Data = {
      savedAt:   1000000,
      project:   { name: 'Preserved' },
      transport: { bpm: 130 },
      mixer:     { channels: {}, buses: [] },
    }
    const result = migrateToLatest(v0Data)
    assert.ok(!isMigrationError(result))
    if (!isMigrationError(result)) {
      const migrated = result.data as Record<string, unknown>
      const project   = migrated.project   as Record<string, unknown>
      const transport = migrated.transport  as Record<string, unknown>
      const mixer     = migrated.mixer      as Record<string, unknown>
      assert.equal(project.name,    'Preserved')
      assert.equal(transport.bpm,   130)
      assert.deepEqual(mixer.buses, [])
    }
  })

  it('adds warnings for missing sections', () => {
    const v0Data = { savedAt: 1000000 }
    const result = migrateToLatest(v0Data)
    assert.ok(!isMigrationError(result))
    if (!isMigrationError(result)) {
      assert.ok(result.warnings.length > 0, 'should have warnings for missing sections')
      // Expect at least warnings for mixer, transport, pianoRoll, midi, project
      assert.ok(result.warnings.some(w => /mixer/i.test(w)), 'should warn about mixer')
    }
  })
})

describe('ProjectMigrator / future version', () => {
  it('returns MigrationError for future version (v99)', () => {
    const futureData = {
      version:    99,
      savedAt:    Date.now(),
      appVersion: '99.0.0',
      project:    null,
    }
    const result = migrateToLatest(futureData)
    assert.ok(isMigrationError(result), 'should be a MigrationError')
    if (isMigrationError(result)) {
      assert.ok(result.error.length > 0, 'error message should not be empty')
      assert.equal(result.fromVersion, 99)
    }
  })
})

describe('ProjectMigrator / isMigrationError', () => {
  it('correctly identifies MigrationError vs MigrationResult', () => {
    const errorResult = migrateToLatest({ version: 99 })
    const goodResult  = migrateToLatest({ version: 1 })

    assert.ok(isMigrationError(errorResult), 'should detect MigrationError')
    assert.ok(!isMigrationError(goodResult), 'should not detect success as MigrationError')
  })
})

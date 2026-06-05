import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateProjectSaveData } from '../../src/renderer/src/audio/save/projectSchema.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'setup', 'fixtures')

async function loadFixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(fixturesDir, name), 'utf8'))
}

describe('projectSchema / valid fixture', () => {
  it('accepts the canonical valid project', async () => {
    const data = await loadFixture('valid-project.json')
    const res = validateProjectSaveData(data)
    assert.equal(res.ok, true, res.ok ? '' : res.reason)
  })
  it('returns coerced/cleaned data with version=1', async () => {
    const data = await loadFixture('valid-project.json')
    const res = validateProjectSaveData(data)
    if (!res.ok) throw new Error(res.reason)
    assert.equal(res.data.version, 1)
    assert.equal(typeof res.data.appVersion, 'string')
  })
})

describe('projectSchema / corrupt fixture', () => {
  it('rejects bpm 9999 with a bpm-related reason', async () => {
    const data = await loadFixture('corrupt-project.json')
    const res = validateProjectSaveData(data)
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /bpm/i)
  })
})

describe('projectSchema / negative cases', () => {
  it('rejects non-objects at root', () => {
    assert.equal(validateProjectSaveData(null).ok, false)
    assert.equal(validateProjectSaveData(42).ok, false)
    assert.equal(validateProjectSaveData('hello').ok, false)
    assert.equal(validateProjectSaveData([1, 2, 3]).ok, false)
  })
  it('rejects missing version', () => {
    const res = validateProjectSaveData({ savedAt: 0 })
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /version/i)
  })
  it('rejects unsupported version (2)', () => {
    const res = validateProjectSaveData({ version: 2 })
    assert.equal(res.ok, false)
  })
  it('rejects bpm at lower boundary (19)', () => {
    const res = validateProjectSaveData({ version: 1, transport: { bpm: 19 } })
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /bpm/i)
  })
  it('rejects bpm above range (1000)', () => {
    const res = validateProjectSaveData({ version: 1, transport: { bpm: 1000 } })
    assert.equal(res.ok, false)
  })
  it('accepts bpm at boundaries 20 and 999', () => {
    assert.equal(validateProjectSaveData({ version: 1, transport: { bpm: 20 } }).ok, true)
    assert.equal(validateProjectSaveData({ version: 1, transport: { bpm: 999 } }).ok, true)
  })
  it('rejects mixer.buses missing id', () => {
    const res = validateProjectSaveData({
      version: 1,
      mixer: { buses: [{ gainDb: 0 }] },
    })
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /id/i)
  })
  it('rejects mixer.buses[].panCenter out of range', () => {
    const res = validateProjectSaveData({
      version: 1,
      mixer: { buses: [{ id: 'a', panCenter: 5 }] },
    })
    assert.equal(res.ok, false)
  })
  it('rejects mixer.channels as array (must be object map)', () => {
    const res = validateProjectSaveData({
      version: 1,
      mixer: { channels: [] },
    })
    assert.equal(res.ok, false)
  })
  it('rejects pianoRoll.notes that is not an array', () => {
    const res = validateProjectSaveData({
      version: 1,
      pianoRoll: { notes: 'oops' },
    })
    assert.equal(res.ok, false)
  })
  it('rejects oversized payload (>50 MB)', () => {
    // Build a single string > 50 MB
    const big = 'x'.repeat(50 * 1024 * 1024 + 10)
    const res = validateProjectSaveData({ version: 1, project: big })
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /too large/i)
  })
  it('rejects non-JSON-serializable data', () => {
    const circular: Record<string, unknown> = { version: 1 }
    circular.self = circular
    const res = validateProjectSaveData(circular)
    assert.equal(res.ok, false)
  })
})

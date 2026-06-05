import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'

const userData = join(tmpdir(), 'neurotek-test-' + process.pid)
const logsDir = join(userData, 'logs')
const logPath = join(logsDir, 'crash.log')
const oldPath = join(logsDir, 'crash.log.old')

// Clean log files before importing the SUT
if (existsSync(logPath)) rmSync(logPath, { force: true })
if (existsSync(oldPath)) rmSync(oldPath, { force: true })

const { logCrash, readRecentCrashes } = await import('../../src/main/modules/errorReporter.ts')

describe('errorReporter / logCrash + readRecentCrashes', () => {
  it('writes an entry that can be read back', async () => {
    await logCrash({ source: 'main', message: 'boom' })
    const list = await readRecentCrashes(10)
    assert.ok(list.length >= 1)
    const last = list[list.length - 1]!
    assert.equal(last.source, 'main')
    assert.equal(last.message, 'boom')
    assert.equal(last.appVersion, '0.0.0-test')
    assert.equal(typeof last.timestamp, 'string')
  })

  it('writes multiple entries as JSONL', async () => {
    await logCrash({ source: 'renderer', message: 'r1' })
    await logCrash({ source: 'plugin', message: 'p1' })
    await logCrash({ source: 'audio',  message: 'a1' })
    const all = await readRecentCrashes(50)
    const messages = all.map(e => e.message)
    assert.ok(messages.includes('r1'))
    assert.ok(messages.includes('p1'))
    assert.ok(messages.includes('a1'))
  })

  it('preserves optional fields stack and meta', async () => {
    await logCrash({ source: 'main', message: 'with-stack', stack: 'Error: x\n  at y', meta: { code: 42 } })
    const list = await readRecentCrashes(50)
    const entry = list.find(e => e.message === 'with-stack')
    assert.ok(entry)
    assert.equal(entry!.stack, 'Error: x\n  at y')
    assert.deepEqual(entry!.meta, { code: 42 })
  })

  it('respects the limit parameter', async () => {
    const list = await readRecentCrashes(2)
    assert.ok(list.length <= 2)
  })

  it('skips malformed lines gracefully', async () => {
    // Sneak a corrupt line into the file
    const fs = await import('node:fs/promises')
    await fs.appendFile(logPath, '{not json\n', 'utf8')
    await logCrash({ source: 'main', message: 'after-malformed' })
    const list = await readRecentCrashes(100)
    const found = list.some(e => e.message === 'after-malformed')
    assert.equal(found, true)
  })
})

describe('errorReporter / rotation at 5 MB', () => {
  before(() => {
    // Pre-load the log file with > 5 MB so rotation triggers on next write.
    mkdirSync(logsDir, { recursive: true })
    const big = JSON.stringify({ pad: 'x'.repeat(1024) }) + '\n'
    // 5 MB / ~1 KB per line ≈ 5200 lines; write 6000 to be safe
    let blob = ''
    for (let i = 0; i < 6000; i++) blob += big
    writeFileSync(logPath, blob, 'utf8')
  })

  it('rotates crash.log → crash.log.old when over 5 MB', async () => {
    const sizeBefore = statSync(logPath).size
    assert.ok(sizeBefore > 5 * 1024 * 1024, `precondition: ${sizeBefore}`)
    await logCrash({ source: 'main', message: 'post-rotate' })
    assert.ok(existsSync(oldPath), 'crash.log.old should exist after rotation')
    const sizeAfter = statSync(logPath).size
    // After rotation, current log holds only the new entry
    assert.ok(sizeAfter < sizeBefore, `expected truncation: ${sizeAfter} vs ${sizeBefore}`)
  })
})

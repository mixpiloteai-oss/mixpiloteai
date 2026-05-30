import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DiagnosticLogger,
  _resetLogger,
} from '../../src/main/DiagnosticLogger.ts'

// Reset singleton before each test
beforeEach(() => {
  _resetLogger()
})

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'diag-test-'))
}

describe('DiagnosticLogger / init', () => {
  it('creates the log directory', async () => {
    const dir    = await makeTmpDir()
    const logDir = join(dir, 'logs')
    const logger = new DiagnosticLogger({ dir: logDir })
    await logger.init()

    const s = await stat(logDir)
    assert.ok(s.isDirectory(), 'log directory should be created')
  })
})

describe('DiagnosticLogger / log', () => {
  it('writes an NDJSON line to the log file', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.log('info', 'test', 'hello world', { extra: 42 })

    const entries = await logger.readAll()
    const entry   = entries.find(e => e.msg === 'hello world')
    assert.ok(entry !== undefined, 'should find the logged entry')
    assert.equal(entry.level, 'info')
    assert.equal(entry.category, 'test')
    const data = entry.data as { extra: number }
    assert.equal(data.extra, 42)
  })

  it('entries have correct pid and sessionId', async () => {
    const dir    = await makeTmpDir()
    const sid    = 'test-session-123'
    const logger = new DiagnosticLogger({ dir, sessionId: sid })
    await logger.init()

    await logger.log('debug', 'cat', 'pid check')

    const entries = await logger.readAll()
    const entry   = entries.find(e => e.msg === 'pid check')
    assert.ok(entry !== undefined)
    assert.equal(entry.pid, process.pid)
    assert.equal(entry.sessionId, sid)
  })
})

describe('DiagnosticLogger / readAll', () => {
  it('returns logged entries in descending ts order', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.log('info', 'cat', 'first')
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 5))
    await logger.log('info', 'cat', 'second')
    await new Promise(r => setTimeout(r, 5))
    await logger.log('info', 'cat', 'third')

    const entries = await logger.readAll()
    // Find our entries (filter out 'Session started')
    const mine = entries.filter(e => ['first', 'second', 'third'].includes(e.msg))
    assert.ok(mine.length >= 2, 'should have at least 2 of our entries')
    // Verify descending order
    for (let i = 0; i < mine.length - 1; i++) {
      assert.ok(
        (mine[i]?.ts ?? 0) >= (mine[i + 1]?.ts ?? 0),
        `entry ${i} should have ts >= entry ${i + 1}`,
      )
    }
  })
})

describe('DiagnosticLogger / logCrash', () => {
  it('logs at fatal level', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.logCrash('Segmentation fault', { code: 11 })

    const entries = await logger.readAll()
    const entry   = entries.find(e => e.msg === 'Segmentation fault')
    assert.ok(entry !== undefined, 'should find crash entry')
    assert.equal(entry.level, 'fatal')
    assert.equal(entry.category, 'crash')
  })
})

describe('DiagnosticLogger / logRecovery', () => {
  it('logs at info level when ok=true', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.logRecovery({ ok: true })

    const entries = await logger.readAll()
    const entry   = entries.find(e => e.category === 'recovery' && e.level === 'info')
    assert.ok(entry !== undefined, 'should log recovery success at info')
  })

  it('logs at error level when ok=false', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.logRecovery({ ok: false, reason: 'checksum mismatch' })

    const entries = await logger.readAll()
    const entry   = entries.find(e => e.category === 'recovery' && e.level === 'error')
    assert.ok(entry !== undefined, 'should log recovery failure at error')
  })
})

describe('DiagnosticLogger / generateReport', () => {
  it('returns correct sessionId and summary counts', async () => {
    const dir    = await makeTmpDir()
    const sid    = 'report-session-xyz'
    const logger = new DiagnosticLogger({ dir, sessionId: sid })
    await logger.init()

    await logger.log('error',   'cat', 'an error')
    await logger.log('warn',    'cat', 'a warning')
    await logger.log('fatal',   'cat', 'a fatal')
    await logger.log('error',   'cat', 'another error')

    const report = await logger.generateReport()
    assert.equal(report.sessionId, sid)
    assert.ok(report.summary.errors >= 2,   `errors should be >= 2, got ${report.summary.errors}`)
    assert.ok(report.summary.warnings >= 1, `warnings should be >= 1, got ${report.summary.warnings}`)
    assert.ok(report.summary.fatals >= 1,   `fatals should be >= 1, got ${report.summary.fatals}`)
    assert.ok(typeof report.platform === 'string')
    assert.ok(typeof report.nodeVersion === 'string')
  })
})

describe('DiagnosticLogger / clearLogs', () => {
  it('removes all log files and readAll returns empty', async () => {
    const dir    = await makeTmpDir()
    const logger = new DiagnosticLogger({ dir })
    await logger.init()

    await logger.log('info', 'cat', 'before clear')
    await logger.clearLogs()

    const entries = await logger.readAll()
    assert.equal(entries.length, 0, 'readAll should return empty after clear')

    // Log files should be gone
    const files = await readdir(dir)
    const logFiles = files.filter(f => f.startsWith('diagnostic-') && f.endsWith('.log'))
    assert.equal(logFiles.length, 0, 'no log files should remain after clearLogs')
  })
})

describe('DiagnosticLogger / prune', () => {
  it('keeps only MAX_FILES=5 files when 7 exist', async () => {
    const dir = await makeTmpDir()

    // Create 7 loggers (each init creates one file)
    for (let i = 0; i < 7; i++) {
      const l = new DiagnosticLogger({ dir, sessionId: `session-${i}` })
      await l.init()
      // Small delay to get distinct filenames
      await new Promise(r => setTimeout(r, 5))
    }

    // Check we have 7 files
    const filesBefore = (await readdir(dir)).filter(
      f => f.startsWith('diagnostic-') && f.endsWith('.log'),
    )
    assert.ok(filesBefore.length >= 5, `should have at least 5 files, got ${filesBefore.length}`)

    // Prune using any logger pointing at the same dir
    const pruner = new DiagnosticLogger({ dir })
    await pruner.prune()

    const filesAfter = (await readdir(dir)).filter(
      f => f.startsWith('diagnostic-') && f.endsWith('.log'),
    )
    assert.ok(filesAfter.length <= 5, `should have at most 5 files after prune, got ${filesAfter.length}`)
  })
})

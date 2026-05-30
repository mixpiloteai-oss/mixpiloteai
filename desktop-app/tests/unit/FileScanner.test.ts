import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FileScanner } from '../../src/main/samples/FileScanner.ts'

// ─── Temp fixture helpers ─────────────────────────────────────────────────────

let root: string

async function mkfile(rel: string, content = 'x'): Promise<void> {
  const abs = join(root, rel)
  await fs.mkdir(join(abs, '..'), { recursive: true })
  await fs.writeFile(abs, content)
}

before(async () => {
  root = join(tmpdir(), `scanner-test-${process.pid}-${Date.now()}`)
  await fs.mkdir(root, { recursive: true })

  // Flat audio files
  await mkfile('kick.wav')
  await mkfile('snare.mp3')
  await mkfile('pad.flac')
  await mkfile('bass.ogg')
  await mkfile('lead.aiff')
  // MIDI
  await mkfile('beat.mid')
  await mkfile('melody.midi')
  // Preset
  await mkfile('synth.fxp')
  await mkfile('synth2.sfz')
  // Unknown extension (should be skipped)
  await mkfile('notes.txt')
  await mkfile('image.png')
  // Subdirectory
  await mkfile('drums/hihat.wav')
  await mkfile('drums/crash.wav')
  await mkfile('drums/sub/room.wav')
  // Hidden directory (should be skipped)
  await mkfile('.hidden/secret.wav')
})

after(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

// ─── scan() ───────────────────────────────────────────────────────────────────

describe('FileScanner / scan()', () => {
  it('discovers all recognized audio files recursively', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const names   = result.entries.map((e) => e.name)
    assert.ok(names.includes('kick'),   'kick.wav found')
    assert.ok(names.includes('snare'),  'snare.mp3 found')
    assert.ok(names.includes('pad'),    'pad.flac found')
    assert.ok(names.includes('bass'),   'bass.ogg found')
    assert.ok(names.includes('lead'),   'lead.aiff found')
    assert.ok(names.includes('hihat'),  'drums/hihat.wav found')
    assert.ok(names.includes('crash'),  'drums/crash.wav found')
    assert.ok(names.includes('room'),   'drums/sub/room.wav found')
  })

  it('skips files with unknown extensions (.txt, .png)', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const names   = result.entries.map((e) => e.name)
    assert.ok(!names.includes('notes'), '.txt should be skipped')
    assert.ok(!names.includes('image'), '.png should be skipped')
  })

  it('skips hidden directories (starting with .)', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const names   = result.entries.map((e) => e.name)
    assert.ok(!names.includes('secret'), '.hidden/secret.wav should be skipped')
  })

  it('classifies MIDI files correctly', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const midEntry  = result.entries.find((e) => e.name === 'beat')
    const midiEntry = result.entries.find((e) => e.name === 'melody')
    assert.ok(midEntry,  'beat.mid found')
    assert.ok(midiEntry, 'melody.midi found')
    assert.equal(midEntry!.type,  'mid')
    assert.equal(midiEntry!.type, 'midi')
  })

  it('classifies preset files (fxp, sfz) as "preset"', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const fxp = result.entries.find((e) => e.name === 'synth')
    const sfz = result.entries.find((e) => e.name === 'synth2')
    assert.ok(fxp, 'synth.fxp found')
    assert.ok(sfz, 'synth2.sfz found')
    assert.equal(fxp!.type, 'preset')
    assert.equal(sfz!.type, 'preset') // sfz → preset
  })

  it('entry has correct ext field (lowercase, no dot)', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const kick    = result.entries.find((e) => e.name === 'kick')
    assert.ok(kick)
    assert.equal(kick!.ext, 'wav')
  })

  it('entry has correct dirPath field', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    const hihat   = result.entries.find((e) => e.name === 'hihat')
    assert.ok(hihat)
    assert.ok(hihat!.dirPath.endsWith('drums'))
  })

  it('entry has positive sizeBytes', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    for (const e of result.entries) {
      assert.ok(e.sizeBytes > 0, `${e.name}: sizeBytes > 0`)
    }
  })

  it('reports scannedDirs > 0 and durationMs >= 0', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root)
    assert.ok(result.scannedDirs > 0)
    assert.ok(result.durationMs >= 0)
  })

  it('maxFiles option caps results', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root, { maxFiles: 3 })
    assert.ok(result.entries.length <= 3, `got ${result.entries.length} entries, expected ≤ 3`)
  })

  it('maxDepth option limits recursion (depth 0 = root only)', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(root, { maxDepth: 0 })
    for (const e of result.entries) {
      assert.equal(e.dirPath, root, `${e.name} should be at root level`)
    }
  })

  it('onProgress callback is called with current dir', async () => {
    const scanner    = new FileScanner()
    const visited: string[] = []
    await scanner.scan(root, {
      onProgress: (_found, dir) => { visited.push(dir) },
    })
    assert.ok(visited.length > 0, 'onProgress should be called at least once')
  })

  it('non-existent root returns error entry (no throw)', async () => {
    const scanner = new FileScanner()
    const result  = await scanner.scan(join(root, 'nonexistent'))
    assert.ok(result.errors.length > 0, 'should report the error')
    assert.equal(result.entries.length, 0)
  })
})

// ─── listDir() ────────────────────────────────────────────────────────────────

describe('FileScanner / listDir()', () => {
  it('returns directories and audio files in root', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(root)
    const names   = items.map((i) => i.name)
    assert.ok(names.includes('drums'), 'drums dir listed')
    assert.ok(names.includes('kick.wav'), 'kick.wav listed')
  })

  it('directories come before files', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(root)
    const firstFile  = items.findIndex((i) => !i.isDir)
    const lastDir    = items.findLastIndex((i) => i.isDir)
    if (firstFile !== -1 && lastDir !== -1) {
      assert.ok(lastDir < firstFile, 'all dirs before files')
    }
  })

  it('skips hidden entries', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(root)
    const names   = items.map((i) => i.name)
    assert.ok(!names.includes('.hidden'))
  })

  it('skips files with unknown extensions', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(root)
    const names   = items.map((i) => i.name)
    assert.ok(!names.includes('notes.txt'))
    assert.ok(!names.includes('image.png'))
  })

  it('hasChildren is true for drums (it has sub/)', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(root)
    const drums   = items.find((i) => i.name === 'drums')
    assert.ok(drums)
    assert.equal(drums!.hasChildren, true)
  })

  it('returns empty array for non-existent directory (no throw)', async () => {
    const scanner = new FileScanner()
    const items   = await scanner.listDir(join(root, 'ghost'))
    assert.deepEqual(items, [])
  })
})

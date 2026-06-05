// ─── VstScannerReal.test.ts ───────────────────────────────────────────────────
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { VstScanner } from '../../src/main/vst/VstScanner.ts'

let scanner: VstScanner
let tmpDir: string

before(() => {
  scanner = new VstScanner()
  tmpDir = mkdtempSync(join(tmpdir(), 'vst-scanner-test-'))
})

after(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('VstScanner.getPlatformVstPaths', () => {
  it('returns a non-empty string array on any platform', () => {
    const paths = scanner.getPlatformVstPaths()
    assert.ok(Array.isArray(paths), 'Should return an array')
    assert.ok(paths.length > 0, 'Should return at least one path')
    for (const p of paths) {
      assert.strictEqual(typeof p, 'string', 'Each path should be a string')
      assert.ok(p.length > 0, 'Paths should not be empty strings')
    }
  })

  it('returns paths that include common VST3 directory patterns on Linux', () => {
    if (process.platform !== 'linux') return
    const paths = scanner.getPlatformVstPaths()
    const hasLinuxPath = paths.some(p => p.includes('vst3') || p.includes('VST3'))
    assert.ok(hasLinuxPath, 'Linux paths should contain vst3 or VST3')
  })
})

describe('VstScanner.scanPlugin', () => {
  it('returns null for non-existent path', async () => {
    const result = await scanner.scanPlugin('/this/path/does/not/exist.vst3')
    assert.strictEqual(result, null)
  })

  it('returns null for a temp directory without Contents/ subdirectory', async () => {
    const emptyVst = join(tmpDir, 'Empty.vst3')
    mkdirSync(emptyVst, { recursive: true })
    const result = await scanner.scanPlugin(emptyVst)
    assert.strictEqual(result, null, 'Should return null when Contents/ is missing')
  })

  it('returns null for a regular file (not a directory)', async () => {
    const filePath = join(tmpDir, 'notadir.vst3')
    writeFileSync(filePath, 'not a plugin')
    const result = await scanner.scanPlugin(filePath)
    assert.strictEqual(result, null, 'Should return null for a file, not a directory')
  })

  it('returns ScannedPlugin from directory with valid moduleinfo.json', async () => {
    // Create a minimal .vst3 bundle
    const pluginDir = join(tmpDir, 'TestSynth.vst3')
    const contentsDir = join(pluginDir, 'Contents')
    mkdirSync(contentsDir, { recursive: true })

    const moduleInfo = {
      Name: 'Test Synth',
      Version: '2.1.0',
      'Factory Info': {
        Vendor: 'Test Audio',
        URL: 'https://example.com',
        'E-Mail': 'test@example.com',
      },
      Classes: [
        {
          CID: 'AABBCCDD11223344AABBCCDD11223344',
          Category: 'Audio Module Class',
          Name: 'Test Synth',
          Subcategories: 'Instrument|Synth',
          Version: '2.1.0',
          SDKVersion: 'VST 3.7.6',
        },
      ],
    }

    writeFileSync(
      join(contentsDir, 'moduleinfo.json'),
      JSON.stringify(moduleInfo),
      'utf-8'
    )

    const result = await scanner.scanPlugin(pluginDir)

    assert.ok(result !== null, 'Should return a ScannedPlugin, not null')
    assert.strictEqual(result.name, 'Test Synth')
    assert.strictEqual(result.vendor, 'Test Audio')
    assert.strictEqual(result.version, '2.1.0')
    assert.strictEqual(result.cid, 'AABBCCDD11223344AABBCCDD11223344')
    assert.strictEqual(result.sdkVersion, 'VST 3.7.6')
    assert.ok(Array.isArray(result.subCategories))
    assert.ok(result.subCategories?.includes('Instrument') || result.subCategories?.includes('Synth'))
    assert.strictEqual(result.category, 'instrument')
    assert.strictEqual(result.path, pluginDir)
    assert.ok(typeof result.id === 'string' && result.id.length > 0)
    assert.ok(typeof result.scanTimestamp === 'number')
  })

  it('returns ScannedPlugin with name from dirname when no moduleinfo.json', async () => {
    const pluginDir = join(tmpDir, 'BarePlugin.vst3')
    const contentsDir = join(pluginDir, 'Contents')
    mkdirSync(contentsDir, { recursive: true })
    // No moduleinfo.json

    const result = await scanner.scanPlugin(pluginDir)
    assert.ok(result !== null, 'Should return a ScannedPlugin even without moduleinfo')
    assert.strictEqual(result.name, 'BarePlugin', 'Name should come from the bundle dirname')
  })
})

describe('VstScanner.parseModuleInfo', () => {
  it('correctly extracts name, vendor, category from valid Steinberg moduleinfo object', () => {
    const moduleInfo = {
      Name: 'Pressure Gate',
      Version: '1.2.0',
      'Factory Info': {
        Vendor: 'Dynamics Labs',
        URL: 'https://dynamicslabs.io',
        'E-Mail': '',
      },
      Classes: [
        {
          CID: 'DEADBEEF00112233DEADBEEF00112233',
          Category: 'Audio Module Class',
          Name: 'Pressure Gate',
          Subcategories: 'Fx|Dynamics',
          Version: '1.2.0',
          SDKVersion: 'VST 3.7.4',
        },
      ],
    }

    const result = scanner.parseModuleInfo(moduleInfo)
    assert.strictEqual(result.name, 'Pressure Gate')
    assert.strictEqual(result.vendor, 'Dynamics Labs')
    assert.strictEqual(result.version, '1.2.0')
    assert.strictEqual(result.sdkVersion, 'VST 3.7.4')
    assert.strictEqual(result.cid, 'DEADBEEF00112233DEADBEEF00112233')
    assert.strictEqual(result.category, 'effect')
    assert.ok(Array.isArray(result.subCategories))
    assert.ok(result.subCategories?.includes('Fx') || result.subCategories?.includes('Dynamics'))
  })

  it('returns instrument category for Synth subcategory', () => {
    const result = scanner.parseModuleInfo({
      'Factory Info': { Vendor: 'Synth Corp' },
      Classes: [{ Name: 'MegaSynth', Subcategories: 'Instrument|Synth' }],
    })
    assert.strictEqual(result.category, 'instrument')
  })

  it('returns unknown category for empty subcategories', () => {
    const result = scanner.parseModuleInfo({
      'Factory Info': { Vendor: 'Unknown Co' },
      Classes: [{ Name: 'Mystery', Subcategories: '' }],
    })
    assert.strictEqual(result.category, 'unknown')
  })

  it('handles legacy flat format (no Factory Info / Classes)', () => {
    const legacy = {
      name: 'LegacyPlugin',
      vendor: 'Old Corp',
      version: '0.9.0',
      category: 'effect',
      hasEditor: true,
      paramCount: 4,
    }
    const result = scanner.parseModuleInfo(legacy)
    assert.strictEqual(result.name, 'LegacyPlugin')
    assert.strictEqual(result.vendor, 'Old Corp')
    assert.strictEqual(result.category, 'effect')
    assert.strictEqual(result.hasEditor, true)
    assert.strictEqual(result.paramCount, 4)
  })
})

describe('VstScanner.hasPlatformBinary', () => {
  it('returns true when appropriate platform binary directory exists', async () => {
    const contentsDir = join(tmpDir, 'BinaryTest', 'Contents')
    // Determine the platform dir name
    const platformDirs: Record<string, string> = {
      win32: 'x86_64-win',
      darwin: 'MacOS',
      linux: 'x86_64-linux',
    }
    const platformDir = platformDirs[process.platform] ?? 'x86_64-linux'
    mkdirSync(join(contentsDir, platformDir), { recursive: true })

    const result = await scanner.hasPlatformBinary(contentsDir)
    assert.strictEqual(result, true, `Should find platform binary dir: ${platformDir}`)
  })

  it('returns false when no binary directory exists', async () => {
    const emptyContents = join(tmpDir, 'NoBinary', 'Contents')
    mkdirSync(emptyContents, { recursive: true })
    const result = await scanner.hasPlatformBinary(emptyContents)
    assert.strictEqual(result, false, 'Should return false when no binary dir found')
  })
})

describe('VstScanner.getPluginBinaryPath', () => {
  it('returns null when no binary exists', async () => {
    const emptyContents = join(tmpDir, 'NoBin', 'Contents')
    mkdirSync(emptyContents, { recursive: true })
    const result = await scanner.getPluginBinaryPath(emptyContents)
    assert.strictEqual(result, null)
  })

  it('returns path to the platform binary when it exists', async () => {
    const contentsDir = join(tmpDir, 'WithBin', 'Contents')
    const platformDirs: Record<string, string> = {
      win32: 'x86_64-win',
      darwin: 'MacOS',
      linux: 'x86_64-linux',
    }
    const exts: Record<string, string> = {
      win32: '.vst3',
      darwin: '',
      linux: '.so',
    }
    const platformDir = platformDirs[process.platform] ?? 'x86_64-linux'
    const ext = exts[process.platform] ?? '.so'
    const binDir = join(contentsDir, platformDir)
    mkdirSync(binDir, { recursive: true })
    const binaryName = ext ? `TestPlugin${ext}` : 'TestPlugin'
    writeFileSync(join(binDir, binaryName), '')

    const result = await scanner.getPluginBinaryPath(contentsDir)
    assert.ok(result !== null, 'Should find the binary')
    assert.ok(result.endsWith(binaryName), `Should point to ${binaryName}`)
  })
})

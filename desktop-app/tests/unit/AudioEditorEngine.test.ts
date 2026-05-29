// ─── AudioEditorEngine.test.ts ────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AudioEditBuffer }  from '../../src/renderer/src/audio/editor/AudioEditBuffer.ts'
import { AudioEditorEngine } from '../../src/renderer/src/audio/editor/AudioEditorEngine.ts'

function makeEngine(data: number[]): AudioEditorEngine {
  const buf = new AudioEditBuffer(1, [new Float32Array(data)])
  return new AudioEditorEngine(buf)
}

describe('AudioEditorEngine / cut', () => {
  it('removes samples and returns them', () => {
    const eng = makeEngine([1, 2, 3, 4, 5])
    const cut = eng.cut(1, 3)
    assert.deepEqual([...cut[0]], [2, 3])
    assert.deepEqual([...eng.export()[0]], [1, 4, 5])
  })

  it('clipboard is set after cut', () => {
    const eng = makeEngine([1, 2, 3])
    eng.cut(0, 2)
    assert.ok(eng.clipboard !== null)
    assert.equal(eng.clipboard![0].length, 2)
  })
})

describe('AudioEditorEngine / copy', () => {
  it('copies samples without removing', () => {
    const eng  = makeEngine([1, 2, 3, 4])
    const copy = eng.copy(1, 3)
    assert.deepEqual([...copy[0]], [2, 3])
    assert.equal(eng.export()[0].length, 4)
  })
})

describe('AudioEditorEngine / paste', () => {
  it('inserts clipboard at offset', () => {
    const eng = makeEngine([1, 2, 3])
    eng.copy(0, 2)
    eng.paste(1)
    assert.deepEqual([...eng.export()[0]], [1, 1, 2, 2, 3])
  })
})

describe('AudioEditorEngine / fadeIn', () => {
  it('linear: first sample ≈ 0, last ≈ original', () => {
    const orig = [0.5, 0.5, 0.5, 0.5, 0.5]
    const eng  = makeEngine(orig)
    eng.fadeIn(0, 5, 'linear')
    const out  = eng.export()[0]
    assert.ok(Math.abs(out[0]) < 0.01)
    assert.ok(Math.abs(out[4] - 0.5) < 0.01)
  })

  it('exponential: gain is 0 at i=0', () => {
    const eng = makeEngine([1, 1, 1, 1, 1])
    eng.fadeIn(0, 5, 'exponential')
    assert.equal(eng.export()[0][0], 0)
  })

  it('sine: first sample ≈ 0', () => {
    const eng = makeEngine([1, 1, 1, 1, 1])
    eng.fadeIn(0, 5, 'sine')
    assert.ok(Math.abs(eng.export()[0][0]) < 0.01)
  })
})

describe('AudioEditorEngine / fadeOut', () => {
  it('linear: last sample ≈ 0', () => {
    const eng = makeEngine([1, 1, 1, 1, 1])
    eng.fadeOut(0, 5, 'linear')
    const out = eng.export()[0]
    assert.ok(Math.abs(out[4]) < 0.01)
    assert.ok(Math.abs(out[0] - 1) < 0.01)
  })
})

describe('AudioEditorEngine / normalize', () => {
  it('scales to target peak dB', () => {
    const eng = makeEngine([0.1, 0.5, -0.4, 0.3])
    eng.normalize(0, 4, 0)  // 0 dBFS = peak = 1.0
    const out  = eng.export()[0]
    let peak   = 0
    for (const v of out) peak = Math.max(peak, Math.abs(v))
    assert.ok(Math.abs(peak - 1.0) < 0.001)
  })

  it('-6 dBFS normalizes to ~0.5 peak', () => {
    const eng = makeEngine([0.1, 0.5, -0.4])
    eng.normalize(0, 3, -6)
    const out  = eng.export()[0]
    let peak   = 0
    for (const v of out) peak = Math.max(peak, Math.abs(v))
    assert.ok(Math.abs(peak - Math.pow(10, -6 / 20)) < 0.001)
  })

  it('all-zero buffer is a no-op', () => {
    const eng = makeEngine([0, 0, 0])
    eng.normalize(0, 3, 0)
    assert.deepEqual([...eng.export()[0]], [0, 0, 0])
  })
})

describe('AudioEditorEngine / reverse', () => {
  it('reverses samples in selection', () => {
    const eng = makeEngine([1, 2, 3, 4, 5])
    eng.reverse(1, 4)
    assert.deepEqual([...eng.export()[0]], [1, 4, 3, 2, 5])
  })

  it('reverse of reverse returns original', () => {
    const orig = [1, 2, 3, 4, 5]
    const eng  = makeEngine(orig)
    eng.reverse(0, 5)
    eng.reverse(0, 5)
    assert.deepEqual([...eng.export()[0]], orig)
  })
})

describe('AudioEditorEngine / gainClip', () => {
  it('+6 dB approximately doubles amplitude', () => {
    const eng   = makeEngine([0.25, 0.5, -0.25])
    eng.gainClip(0, 3, 6)
    const out   = eng.export()[0]
    const scale = Math.pow(10, 6 / 20)
    assert.ok(Math.abs(out[1] - 0.5 * scale) < 0.001)
  })

  it('0 dB is a no-op', () => {
    const data = [0.1, 0.5, -0.3]
    const eng  = makeEngine(data)
    eng.gainClip(0, 3, 0)
    const out = eng.export()[0]
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i] - data[i]) < 1e-6)
  })
})

describe('AudioEditorEngine / timestretch', () => {
  it('factor=2 halves output length (approximately)', () => {
    const N   = 100
    const eng = makeEngine(Array.from({ length: N }, (_, i) => i / N))
    eng.timestretch(0, N, 2)
    const outLen = eng.export()[0].length
    const expected = Math.round((N - 1) / 2) + 1
    assert.equal(outLen, expected)
  })

  it('factor=0.5 doubles output length', () => {
    const N   = 100
    const eng = makeEngine(Array.from({ length: N }, (_, i) => i / N))
    eng.timestretch(0, N, 0.5)
    const outLen  = eng.export()[0].length
    const expected = Math.round((N - 1) / 0.5) + 1
    assert.equal(outLen, expected)
  })

  it('factor=1 produces same length', () => {
    const N   = 50
    const eng = makeEngine(Array.from({ length: N }, () => 0.5))
    eng.timestretch(0, N, 1)
    assert.equal(eng.export()[0].length, N)
  })
})

describe('AudioEditorEngine / undo + redo', () => {
  it('undo restores previous state', () => {
    const eng = makeEngine([1, 2, 3])
    eng.reverse(0, 3)
    eng.undo_()
    assert.deepEqual([...eng.export()[0]], [1, 2, 3])
  })

  it('redo re-applies operation', () => {
    const eng = makeEngine([1, 2, 3])
    eng.reverse(0, 3)
    eng.undo_()
    eng.redo_()
    assert.deepEqual([...eng.export()[0]], [3, 2, 1])
  })

  it('new operation clears redo stack', () => {
    const eng = makeEngine([1, 2, 3])
    eng.reverse(0, 3)
    eng.undo_()
    eng.gainClip(0, 3, 0)
    assert.equal(eng.canRedo(), false)
  })

  it('canUndo is false on fresh engine', () => {
    const eng = makeEngine([1, 2, 3])
    assert.equal(eng.canUndo(), false)
  })

  it('undo stack caps at MAX depth (50)', () => {
    const eng = makeEngine([1, 2, 3])
    for (let i = 0; i < 55; i++) eng.gainClip(0, 3, 0)
    // Engine should not throw and should have at most 50 undos
    let count = 0
    while (eng.canUndo()) { eng.undo_(); count++ }
    assert.ok(count <= 50)
  })
})

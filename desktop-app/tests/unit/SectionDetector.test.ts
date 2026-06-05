// ─── SectionDetector.test.ts ──────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectSections,
  getSectionColor,
} from '../../src/renderer/src/audio/workflow/SectionDetector.ts'
import type { Project } from '../../src/renderer/src/types/project.ts'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id:                       'test-proj',
    name:                     'Test',
    bpm:                      120,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             -6,
    loopStart:                1,
    loopEnd:                  17,
    totalBars:                16,
    tracks:                   [],
    ...overrides,
  }
}

describe('SectionDetector / detectSections', () => {
  it('empty project (totalBars=0) returns []', () => {
    const project = makeProject({ totalBars: 0 })
    const sections = detectSections(project)
    assert.deepEqual(sections, [])
  })

  it('project with clips in bars 1–4 returns non-empty sections', () => {
    const project = makeProject({
      totalBars: 16,
      tracks: [
        {
          id: 'tk-1', name: 'Kick', type: 'midi', color: '#f97316',
          gainDb: 0, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [
            {
              id: 'c1', trackId: 'tk-1', name: 'Clip A',
              startBar: 1, lengthBars: 4, color: '#f97316', muted: false, notes: [],
            },
          ],
        },
      ],
    })
    const sections = detectSections(project)
    assert.ok(sections.length > 0, 'should return at least one section')
  })

  it('getSectionColor chorus returns #10b981', () => {
    assert.equal(getSectionColor('chorus'), '#10b981')
  })

  it('getSectionColor drop returns #ef4444', () => {
    assert.equal(getSectionColor('drop'), '#ef4444')
  })

  it('all sections have startBar <= endBar', () => {
    const project = makeProject({
      totalBars: 32,
      tracks: [
        {
          id: 'tk-1', name: 'Bass', type: 'midi', color: '#7c3aed',
          gainDb: -2, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [
            { id: 'c1', trackId: 'tk-1', name: 'A', startBar: 1,  lengthBars: 8,  color: '#7c3aed', muted: false, notes: [] },
            { id: 'c2', trackId: 'tk-1', name: 'B', startBar: 9,  lengthBars: 8,  color: '#7c3aed', muted: false, notes: [] },
            { id: 'c3', trackId: 'tk-1', name: 'C', startBar: 17, lengthBars: 8,  color: '#7c3aed', muted: false, notes: [] },
            { id: 'c4', trackId: 'tk-1', name: 'D', startBar: 25, lengthBars: 8,  color: '#7c3aed', muted: false, notes: [] },
          ],
        },
      ],
    })
    const sections = detectSections(project)
    for (const s of sections) {
      assert.ok(s.startBar <= s.endBar, `startBar ${s.startBar} should be <= endBar ${s.endBar}`)
    }
  })

  it('all sections have intensity between 0 and 1', () => {
    const project = makeProject({
      totalBars: 16,
      tracks: [
        {
          id: 'tk-1', name: 'Lead', type: 'midi', color: '#10b981',
          gainDb: -4, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [
            { id: 'c1', trackId: 'tk-1', name: 'A', startBar: 1,  lengthBars: 4, color: '#10b981', muted: false, notes: [] },
            { id: 'c2', trackId: 'tk-1', name: 'B', startBar: 9,  lengthBars: 4, color: '#10b981', muted: false, notes: [] },
          ],
        },
      ],
    })
    const sections = detectSections(project)
    for (const s of sections) {
      assert.ok(s.intensity >= 0 && s.intensity <= 1, `intensity ${s.intensity} should be 0–1`)
    }
  })
})

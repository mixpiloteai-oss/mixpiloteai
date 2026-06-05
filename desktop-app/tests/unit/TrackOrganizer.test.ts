// ─── TrackOrganizer.test.ts ───────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  suggestColors,
  suggestNames,
  suggestGroups,
  analyzeOrganization,
} from '../../src/renderer/src/audio/workflow/TrackOrganizer.ts'
import type { Track, Project } from '../../src/renderer/src/types/project.ts'

function makeTrack(overrides: Partial<Track> & Pick<Track, 'id' | 'name' | 'type'>): Track {
  return {
    color:     '#000000',
    gainDb:    0,
    panCenter: 0,
    muted:     false,
    soloed:    false,
    armed:     false,
    sends:     [],
    clips:     [],
    height:    64,
    ...overrides,
  }
}

describe('TrackOrganizer / suggestColors', () => {
  it('track named KICK suggests orange #f97316', () => {
    const tracks = [makeTrack({ id: 'tk-1', name: 'KICK', type: 'midi' })]
    const suggestions = suggestColors(tracks)
    assert.ok(suggestions.length > 0)
    assert.equal(suggestions[0]?.suggestedColor, '#f97316')
  })

  it('track named BASS LINE suggests purple #7c3aed', () => {
    const tracks = [makeTrack({ id: 'tk-2', name: 'BASS LINE', type: 'midi' })]
    const suggestions = suggestColors(tracks)
    assert.ok(suggestions.length > 0)
    assert.equal(suggestions[0]?.suggestedColor, '#7c3aed')
  })

  it('track named Lead Synth suggests green #10b981', () => {
    const tracks = [makeTrack({ id: 'tk-3', name: 'Lead Synth', type: 'midi' })]
    const suggestions = suggestColors(tracks)
    assert.ok(suggestions.length > 0)
    assert.equal(suggestions[0]?.suggestedColor, '#10b981')
  })
})

describe('TrackOrganizer / suggestNames', () => {
  it('track named Track 1 with type midi suggests rename to MIDI 1', () => {
    const tracks = [makeTrack({ id: 'tk-1', name: 'Track 1', type: 'midi' })]
    const suggestions = suggestNames(tracks)
    assert.ok(suggestions.length > 0)
    assert.ok(suggestions[0]?.suggestedName.startsWith('MIDI'), 'should suggest MIDI name')
  })
})

describe('TrackOrganizer / suggestGroups', () => {
  it('tracks named kick/snare/hihat suggest DRUMS group', () => {
    const tracks = [
      makeTrack({ id: 'tk-1', name: 'kick',  type: 'midi' }),
      makeTrack({ id: 'tk-2', name: 'snare', type: 'midi' }),
      makeTrack({ id: 'tk-3', name: 'hihat', type: 'midi' }),
    ]
    const groups = suggestGroups(tracks)
    const drums = groups.find(g => g.groupName === 'DRUMS')
    assert.ok(drums, 'should suggest DRUMS group')
    assert.ok(drums.trackIds.length >= 2, 'DRUMS group should have at least 2 tracks')
  })
})

describe('TrackOrganizer / analyzeOrganization', () => {
  it('project with generic track names yields non-empty names suggestions', () => {
    const project: Project = {
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
      tracks: [
        makeTrack({ id: 'tk-1', name: 'Track',   type: 'midi' }),
        makeTrack({ id: 'tk-2', name: 'Track 2', type: 'audio' }),
      ],
    }
    const result = analyzeOrganization(project)
    assert.ok(result.names.length > 0, 'names suggestions should be non-empty')
  })
})

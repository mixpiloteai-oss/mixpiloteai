import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SampleRelinker } from '../../src/renderer/src/audio/safety/SampleRelinker.ts'
import type { SerializedTrack } from '../../src/renderer/src/audio/safety/ProjectSerializer.ts'

function makeTrack(clipId: string): SerializedTrack {
  return {
    id: 'tk-1',
    name: 'Audio Track',
    type: 'audio',
    volume: 0,
    pan: 0,
    muted: false,
    soloed: false,
    clips: [{ id: clipId, startBeat: 0, durationBeats: 4 }],
  }
}

describe('SampleRelinker', () => {
  let relinker: SampleRelinker

  // Reinitialize for each test
  relinker = new SampleRelinker()

  describe('scanForMissingFiles', () => {
    it('marks paths starting with /missing/ as found=false', () => {
      const tracks = [makeTrack('clip-1')]
      const result = relinker.scanForMissingFiles(tracks, ['/missing/kick.wav'])
      assert.equal(result.length, 1)
      assert.equal(result[0].found, false)
      assert.equal(result[0].clipId, 'clip-1')
      assert.equal(result[0].originalPath, '/missing/kick.wav')
    })

    it('marks normal paths as found=true', () => {
      const tracks = [makeTrack('clip-2')]
      const result = relinker.scanForMissingFiles(tracks, ['/samples/kick.wav'])
      assert.equal(result.length, 1)
      assert.equal(result[0].found, true)
    })

    it('skips non-file-path strings (no slash or no extension)', () => {
      const tracks = [makeTrack('clip-3')]
      const result = relinker.scanForMissingFiles(tracks, ['just-a-string', 'noExtension/here'])
      // 'just-a-string' has no slash — skipped
      // 'noExtension/here' has no dot — skipped
      assert.equal(result.length, 0)
    })

    it('returns searchName as the basename of the original path', () => {
      const tracks = [makeTrack('clip-4')]
      const result = relinker.scanForMissingFiles(tracks, ['/missing/snare-hard.wav'])
      assert.equal(result[0].searchName, 'snare-hard.wav')
    })

    it('handles multiple tracks and multiple clips', () => {
      const tracks: SerializedTrack[] = [
        makeTrack('clip-5'),
        { ...makeTrack('clip-6'), id: 'tk-2' },
      ]
      const result = relinker.scanForMissingFiles(tracks, ['/missing/hat.wav'])
      // Each clip gets an entry for each path
      assert.equal(result.length, 2)
    })
  })

  describe('suggestRelinkPath', () => {
    it('returns the matching path when basenames match (case-insensitive)', () => {
      const missing = {
        clipId: 'clip-1',
        originalPath: '/missing/Kick.wav',
        searchName: 'Kick.wav',
        found: false,
      }
      const available = ['/new-location/kick.wav', '/other/snare.wav']
      const result = relinker.suggestRelinkPath(missing, available)
      assert.equal(result, '/new-location/kick.wav')
    })

    it('returns null when no matching path is found', () => {
      const missing = {
        clipId: 'clip-2',
        originalPath: '/missing/tom.wav',
        searchName: 'tom.wav',
        found: false,
      }
      const result = relinker.suggestRelinkPath(missing, ['/samples/kick.wav', '/samples/snare.wav'])
      assert.equal(result, null)
    })

    it('returns the first match if multiple candidates exist', () => {
      const missing = {
        clipId: 'clip-3',
        originalPath: '/missing/loop.wav',
        searchName: 'loop.wav',
        found: false,
      }
      const available = ['/a/loop.wav', '/b/loop.wav']
      const result = relinker.suggestRelinkPath(missing, available)
      assert.equal(result, '/a/loop.wav')
    })
  })

  describe('buildRelinkMap', () => {
    it('builds a correct Map<clipId, newPath>', () => {
      const resolutions = [
        { clipId: 'clip-1', newPath: '/new/kick.wav' },
        { clipId: 'clip-2', newPath: '/new/snare.wav' },
      ]
      const map = relinker.buildRelinkMap(resolutions)
      assert.equal(map.get('clip-1'), '/new/kick.wav')
      assert.equal(map.get('clip-2'), '/new/snare.wav')
      assert.equal(map.size, 2)
    })

    it('returns an empty Map for empty input', () => {
      const map = relinker.buildRelinkMap([])
      assert.equal(map.size, 0)
    })
  })
})

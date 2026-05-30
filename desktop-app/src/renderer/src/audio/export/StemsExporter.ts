// ─── Stems Exporter ───────────────────────────────────────────────────────────
// Renders individual track stems via ProjectRenderer (real audio synthesis).
// Each stem = one track with its clips rendered to a Float32Array buffer.

import { normalize, type NormMode } from './Normalizer'
import { ditherBuffer, type DitherType } from './Dithering'
import { encodeWav } from './encoders/WavEncoder'
import { encodeFlac } from './encoders/FlacEncoder'
import type { ExportFormat, ExportQualityPreset } from './ExportPipeline'
import { renderProject, defaultRenderOptions, type ProjectRenderOptions } from './ProjectRenderer'
import type { Project } from '../../types/project'

export interface StemDefinition {
  trackId:   string
  trackName: string
  color:     string
}

export interface StemResult {
  trackId:   string
  trackName: string
  blob:      Blob
  format:    ExportFormat
  durationSec: number
  sizeMB:    number
  peakdBFS:  number
}

export type StemsProgressCallback = (
  done: number,
  total: number,
  currentTrack: string,
  pct: number,
) => void

export interface StemsOptions {
  format:       ExportFormat
  quality:      ExportQualityPreset
  normMode:     NormMode
  normTargetDB: number
  dither:       DitherType
  bitDepth:     16 | 24 | 32
  sampleRate:   number
  durationSec:  number
  // Optional project for real rendering; if absent falls back to silence
  project?:     Project
  renderOpts?:  Partial<ProjectRenderOptions>
}

function buildFakeAudioBuffer(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): AudioBuffer {
  // Minimal AudioBuffer-compatible object for the normalization/dithering API.
  // In a browser context, OfflineAudioContext.createBuffer would be used instead.
  let _left  = left
  let _right = right
  return {
    sampleRate,
    numberOfChannels: 2,
    length: left.length,
    duration: left.length / sampleRate,
    getChannelData: (ch: number) => (ch === 0 ? _left : _right),
    copyFromChannel: () => {},
    copyToChannel:   () => {},
  } as unknown as AudioBuffer
}

function renderStemSync(
  trackId:    string,
  options:    StemsOptions,
  onProgress: (pct: number) => void,
): { buffer: AudioBuffer; peakdBFS: number } {
  onProgress(5)

  let left:  Float32Array
  let right: Float32Array

  if (options.project) {
    const opts = {
      ...defaultRenderOptions(options.project, options.sampleRate),
      ...options.renderOpts,
      selectedTrackIds: [trackId],
      includeMuted:     true,   // we're rendering this track regardless of mute state
    }
    const result = renderProject(options.project, opts)
    left  = result.mixLeft
    right = result.mixRight
  } else {
    // Fallback: silent buffer
    const len = Math.ceil(options.durationSec * options.sampleRate)
    left  = new Float32Array(len)
    right = new Float32Array(len)
  }

  onProgress(60)

  const buffer = buildFakeAudioBuffer(left, right, options.sampleRate)

  // Normalization
  normalize(buffer, options.normMode, options.normTargetDB)
  onProgress(80)

  // Dithering
  if (options.bitDepth < 32) ditherBuffer(buffer, options.bitDepth as 16 | 24, options.dither)

  // Measure peak
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) { const abs = Math.abs(ch[i]!); if (abs > peak) peak = abs }
  }
  const peakdBFS = peak > 0 ? 20 * Math.log10(peak) : -Infinity

  onProgress(100)
  return { buffer, peakdBFS }
}

export async function exportStems(
  stems:      StemDefinition[],
  options:    StemsOptions,
  onProgress: StemsProgressCallback,
): Promise<StemResult[]> {
  const results: StemResult[] = []

  for (let idx = 0; idx < stems.length; idx++) {
    const stem = stems[idx]!
    onProgress(idx, stems.length, stem.trackName, 0)

    const { buffer, peakdBFS } = renderStemSync(
      stem.trackId, options,
      (pct) => onProgress(idx, stems.length, stem.trackName, pct),
    )

    let blob: Blob
    if (options.format === 'flac') {
      const ab = encodeFlac(buffer, { bitDepth: options.bitDepth === 32 ? 24 : options.bitDepth as 16|24 })
      blob = new Blob([ab], { type: 'audio/flac' })
    } else if (options.format === 'mp3') {
      const { encodeMp3 } = await import('./encoders/Mp3Encoder')
      const mp3 = await encodeMp3(buffer, { bitrate: 320 })
      blob = new Blob([mp3.data.buffer as ArrayBuffer], { type: 'audio/mpeg' })
    } else {
      const ab = encodeWav(buffer, { bitDepth: options.bitDepth, floatFormat: options.bitDepth === 32, metadata: { title: stem.trackName } })
      blob = new Blob([ab], { type: 'audio/wav' })
    }

    results.push({
      trackId:   stem.trackId,
      trackName: stem.trackName,
      blob,
      format:    options.format,
      durationSec: buffer.duration,
      sizeMB:    Math.round(blob.size / 1024 / 1024 * 10) / 10,
      peakdBFS,
    })

    onProgress(idx + 1, stems.length, stem.trackName, 100)
  }

  return results
}

/** Zip stems into a single downloadable archive using CompressionStream. */
export async function downloadStemsAsZip(results: StemResult[], projectName: string): Promise<void> {
  // Simple approach: download each stem individually
  // For real ZIP: use JSZip or native CompressionStream (no ZIP header support in browsers yet)
  for (const stem of results) {
    const ext  = stem.format === 'mp3' ? 'mp3' : stem.format === 'flac' ? 'flac' : 'wav'
    const name = `${projectName} — ${stem.trackName}.${ext}`.replace(/[/\\:*?"<>|]/g, '_')
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(stem.blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    // Small delay between downloads to avoid browser blocking
    await new Promise(r => setTimeout(r, 300))
  }
}

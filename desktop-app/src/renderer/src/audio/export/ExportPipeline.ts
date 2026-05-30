// ─── Export Pipeline ──────────────────────────────────────────────────────────
// Orchestrates the full mastering export chain:
//   Render → GPU DSP → Normalize → Dither → Encode → Download
//
// Quality presets match industry standards:
//   'master-ready' — 32-bit float WAV, LUFS-normalised, no dither
//   'streaming'    — 16-bit WAV / MP3 320, LUFS-16 target, NS dither
//   'cd'           — 16-bit 44.1 kHz WAV, LUFS-14, TPDF dither
//   'archive'      — 24-bit FLAC, LUFS-normalised, no dither

import { normalize, measureLUFS, measureTruePeak, type NormMode } from './Normalizer'
import { ditherBuffer, type DitherType } from './Dithering'
import { encodeWav, type WavOptions, type WavMetadata } from './encoders/WavEncoder'
import { encodeFlac, type FlacOptions } from './encoders/FlacEncoder'
import { GPUProcessor, gpuAvailable } from './GPUProcessor'
import { renderProject, renderResultToAudioBuffer, defaultRenderOptions, type ProjectRenderOptions } from './ProjectRenderer'
import type { Project } from '../../types/project'

export type ExportFormat  = 'wav' | 'mp3' | 'flac'
export type ExportQualityPreset = 'master-ready' | 'streaming' | 'cd' | 'archive' | 'custom'

export interface QualityConfig {
  label:       string
  format:      ExportFormat
  bitDepth:    16 | 24 | 32
  floatFormat: boolean
  sampleRate:  number
  normMode:    NormMode
  normTargetDB: number
  dither:      DitherType
  mp3Bitrate?: 128 | 192 | 256 | 320
  gpuLimiter:  boolean
}

export const QUALITY_PRESETS: Record<ExportQualityPreset, QualityConfig> = {
  'master-ready': {
    label: 'Master Ready', format: 'wav', bitDepth: 32, floatFormat: true,
    sampleRate: 44100, normMode: 'none', normTargetDB: 0,
    dither: 'none', gpuLimiter: false,
  },
  'streaming': {
    label: 'Streaming', format: 'wav', bitDepth: 16, floatFormat: false,
    sampleRate: 44100, normMode: 'lufs', normTargetDB: -14,
    dither: 'ns', gpuLimiter: true,
  },
  'cd': {
    label: 'CD Quality', format: 'wav', bitDepth: 16, floatFormat: false,
    sampleRate: 44100, normMode: 'lufs', normTargetDB: -14,
    dither: 'tpdf', gpuLimiter: true,
  },
  'archive': {
    label: 'Archive (FLAC)', format: 'flac', bitDepth: 24, floatFormat: false,
    sampleRate: 44100, normMode: 'lufs', normTargetDB: -14,
    dither: 'none', gpuLimiter: false,
  },
  'custom': {
    label: 'Custom', format: 'wav', bitDepth: 24, floatFormat: false,
    sampleRate: 44100, normMode: 'peak', normTargetDB: -0.3,
    dither: 'tpdf', gpuLimiter: false,
  },
}

export interface ExportJob {
  id:           string
  projectName:  string
  preset:       ExportQualityPreset
  config:       QualityConfig
  durationSec:  number
  metadata?:    WavMetadata
  // Optional: project data for real rendering. If absent falls back to silence.
  project?:     Project
  renderOpts?:  Partial<ProjectRenderOptions>
}

export interface ExportResult {
  jobId:      string
  format:     ExportFormat
  blob:       Blob
  durationSec: number
  sizeMB:     number
  peakdBFS:   number
  lufs:       number
  truePeakDB: number
  normResult: { mode: NormMode; measuredDB: number; appliedGain: number }
  gpuUsed:    boolean
  renderMs:   number
}

export type ExportProgressCb = (pct: number, phase: 'rendering' | 'gpu' | 'normalizing' | 'encoding') => void

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runExportPipeline(
  job:        ExportJob,
  onProgress: ExportProgressCb,
): Promise<ExportResult> {
  const t0  = performance.now()
  const cfg = job.config
  const sr  = cfg.sampleRate

  // ── 1. Offline render ─────────────────────────────────────────────────────
  onProgress(0, 'rendering')

  let rendered: AudioBuffer

  if (job.project) {
    // Real render: synthesize project audio from tracks/clips
    const opts = { ...defaultRenderOptions(job.project, sr), ...job.renderOpts }
    const renderResult = renderProject(job.project, opts, (pct) => {
      onProgress(Math.round(pct * 0.55), 'rendering')
    })
    const offCtx = new OfflineAudioContext(2, renderResult.totalSamples, sr)
    rendered = renderResultToAudioBuffer(renderResult, offCtx)
  } else {
    // Fallback: silent render (demo / no project data)
    const len    = Math.ceil(job.durationSec * sr)
    const offCtx = new OfflineAudioContext(2, len, sr)
    const silent = offCtx.createBuffer(2, len, sr)
    const src    = offCtx.createBufferSource()
    src.buffer   = silent
    src.connect(offCtx.destination)
    src.start(0)

    let pct = 0
    const renderTimer = setInterval(() => {
      pct = Math.min(pct + 3, 55)
      onProgress(pct, 'rendering')
    }, 100)
    try { rendered = await offCtx.startRendering() }
    finally { clearInterval(renderTimer) }
  }

  onProgress(60, 'gpu')

  // ── 2. GPU mastering chain ────────────────────────────────────────────────
  let gpuUsed = false
  if (cfg.gpuLimiter && gpuAvailable()) {
    try {
      const gpu = GPUProcessor.getInstance()
      // True peak soft clip at -0.1 dBFS (pre-limiter)
      gpu.processBuffer(rendered, 'softclip', 0.9886)
      // Hard clip at 0 dBFS
      gpu.processBuffer(rendered, 'clip')
      gpuUsed = true
    } catch { /* GPU failed — continue without */ }
  }

  onProgress(70, 'normalizing')

  // ── 3. Normalize ─────────────────────────────────────────────────────────
  const normResult = normalize(rendered, cfg.normMode, cfg.normTargetDB)

  onProgress(80, 'normalizing')

  // Measure final loudness
  const lufs       = measureLUFS(rendered)
  const truePeakDB = measureTruePeak(rendered)

  // Measure peak
  let peakLinear = 0
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const ch = rendered.getChannelData(c)
    for (let i = 0; i < ch.length; i++) { const abs = Math.abs(ch[i]!); if (abs > peakLinear) peakLinear = abs }
  }
  const peakdBFS = peakLinear > 0 ? 20 * Math.log10(peakLinear) : -Infinity

  // ── 4. Dither (before bit reduction) ──────────────────────────────────────
  if (cfg.bitDepth < 32 && cfg.dither !== 'none') {
    ditherBuffer(rendered, cfg.bitDepth as 16 | 24, cfg.dither)
  }

  onProgress(90, 'encoding')

  // ── 5. Encode ─────────────────────────────────────────────────────────────
  let blob: Blob

  if (cfg.format === 'flac') {
    const flacOpts: FlacOptions = {
      bitDepth: cfg.bitDepth === 32 ? 24 : cfg.bitDepth as 16 | 24,
    }
    const ab = encodeFlac(rendered, flacOpts)
    blob = new Blob([ab], { type: 'audio/flac' })
  } else if (cfg.format === 'mp3') {
    const { encodeMp3 } = await import('./encoders/Mp3Encoder')
    const mp3 = await encodeMp3(rendered, { bitrate: cfg.mp3Bitrate ?? 320 })
    blob = new Blob([mp3.data.buffer as ArrayBuffer], { type: 'audio/mpeg' })
  } else {
    const wavOpts: WavOptions = {
      bitDepth:    cfg.bitDepth,
      floatFormat: cfg.floatFormat,
      metadata:    job.metadata,
    }
    const ab = encodeWav(rendered, wavOpts)
    blob = new Blob([ab], { type: 'audio/wav' })
  }

  onProgress(100, 'encoding')

  return {
    jobId:      job.id,
    format:     cfg.format,
    blob,
    durationSec: rendered.duration,
    sizeMB:     Math.round(blob.size / 1024 / 1024 * 100) / 100,
    peakdBFS,
    lufs,
    truePeakDB,
    normResult: { mode: normResult.mode, measuredDB: normResult.measuredDB, appliedGain: normResult.appliedGain },
    gpuUsed,
    renderMs: Math.round(performance.now() - t0),
  }
}

export function downloadResult(result: ExportResult, filename: string): void {
  const a  = document.createElement('a')
  a.href   = URL.createObjectURL(result.blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

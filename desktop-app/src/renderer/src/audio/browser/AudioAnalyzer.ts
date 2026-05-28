import { getBpmDetector }  from './BpmDetector'
import { getKeyDetector }  from './KeyDetector'
import { StyleClassifier } from './StyleClassifier'
import type { SampleEntry } from './types'
import { getAudioCache }   from './AudioCache'

export interface AnalysisResult {
  id:           string
  bpm:          number | null
  key:          string | null
  style:        string[]
  duration:     number
  sampleRate:   number
  channels:     number
  waveformData: number[] // 200 points
}

export class AudioAnalyzer {
  private audioCtx:    AudioContext | null = null
  private classifier = new StyleClassifier()
  private cache      = getAudioCache()
  private queue:     SampleEntry[] = []
  private concurrency = 2 // max parallel analyses
  private active      = 0

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext()
    return this.audioCtx
  }

  async analyze(entry: SampleEntry): Promise<AnalysisResult | null> {
    if (!entry.fileHandle) return null
    try {
      const file   = await entry.fileHandle.getFile()
      const ab     = await file.arrayBuffer()
      const ctx    = this.getCtx()
      const buffer = await ctx.decodeAudioData(ab)

      const [bpm, key, waveformData] = await Promise.all([
        Promise.resolve(getBpmDetector().detect(buffer)),
        Promise.resolve(getKeyDetector().detect(buffer)),
        Promise.resolve(this.generateWaveform(buffer, 200)),
      ])
      const style = this.classifier.classify(buffer, entry.name)

      return {
        id: entry.id, bpm, key, style,
        duration:   buffer.duration,
        sampleRate: buffer.sampleRate,
        channels:   buffer.numberOfChannels,
        waveformData,
      }
    } catch {
      return null
    }
  }

  enqueue(entries: SampleEntry[], onResult: (result: AnalysisResult) => void): void {
    this.queue.push(...entries.filter(e => !e.analyzed && e.fileHandle))
    this._pump(onResult)
  }

  private _pump(onResult: (result: AnalysisResult) => void): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!
      this.active++
      this.analyze(entry).then(result => {
        this.active--
        if (result) {
          onResult(result)
          this.cache.put({
            ...entry,
            ...result,
            analyzed:     true,
            fileHandle:   undefined,
            userTags:     entry.userTags,
            favorite:     entry.favorite,
            dateAdded:    entry.dateAdded,
            waveformData: result.waveformData,
          })
        }
        this._pump(onResult)
      })
    }
  }

  generateWaveform(buffer: AudioBuffer, points: number): number[] {
    const mono = new Float32Array(buffer.length)
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < buffer.length; i++) mono[i] += data[i] ?? 0
    }
    const invCh  = 1 / buffer.numberOfChannels
    const step   = Math.floor(buffer.length / points)
    const result: number[] = []
    let   maxVal = 0

    for (let i = 0; i < points; i++) {
      let rms = 0
      for (let j = 0; j < step; j++) {
        const v = (mono[i * step + j] ?? 0) * invCh
        rms += v * v
      }
      const val = Math.sqrt(rms / step)
      result.push(val)
      if (val > maxVal) maxVal = val
    }

    // Normalize
    if (maxVal > 0) for (let i = 0; i < result.length; i++) result[i]! /= maxVal
    return result
  }

  cancelAll(): void {
    this.queue = []
  }
}

let _instance: AudioAnalyzer | null = null

export function getAudioAnalyzer(): AudioAnalyzer {
  if (!_instance) _instance = new AudioAnalyzer()
  return _instance
}

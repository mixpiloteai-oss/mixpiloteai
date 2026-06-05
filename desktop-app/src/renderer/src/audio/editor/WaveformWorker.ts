// ─── WaveformWorker ───────────────────────────────────────────────────────────
// Web Worker — off-main-thread peak computation.
// Instantiated via: new Worker(new URL('./WaveformWorker.ts', import.meta.url))

import { WaveformCache } from './WaveformCache'

const cache = new WaveformCache()

interface WorkerRequest {
  id:              string
  buffer:          Float32Array
  samplesPerPixel: number
  bufferId:        string
}

interface WorkerResponse {
  id:    string
  peaks: { min: Float32Array; max: Float32Array; rms: Float32Array }
}

self.onmessage = (ev: MessageEvent<WorkerRequest>): void => {
  const { id, buffer, samplesPerPixel, bufferId } = ev.data
  const key   = cache.cacheKey(bufferId, samplesPerPixel)
  let   peaks = cache.get(key)
  if (!peaks) {
    peaks = cache.computePeaks(buffer, samplesPerPixel)
    cache.set(key, peaks)
  }
  const response: WorkerResponse = { id, peaks }
  ;(self as unknown as Worker).postMessage(response, [
    peaks.min.buffer,
    peaks.max.buffer,
    peaks.rms.buffer,
  ])
}

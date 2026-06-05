// ─── DspWorker — typed async facade over WorkerPool ──────────────────────────
// Provides strongly-typed async functions for DSP operations.
// Browser-only (uses Web Workers under the hood via WorkerPool).

import { getWorkerPool } from '../audio/WorkerPool'
import type { DSPResult } from '../audio/workers/dsp.worker'

let _idCounter = 0
function nextId(): string {
  return `dsp-${Date.now()}-${_idCounter++}`
}

export interface PeakScanResult {
  peak:  number
  rms:   number
  dBFS:  number
}

/**
 * Scan a Float32Array for peak level, RMS, and dBFS.
 * The samples buffer is transferred (zero-copy) to the worker.
 */
export async function peakScan(samples: Float32Array): Promise<PeakScanResult> {
  const id  = nextId()
  const res = await getWorkerPool().dispatch(
    { id, type: 'peak-scan', payload: { samples } },
    [samples.buffer],
  ) as Extract<DSPResult, { type: 'peak-scan' }>
  return { peak: res.peak, rms: res.rms, dBFS: res.dBFS }
}

/**
 * Normalise samples so the peak matches targetDb (default -0.1 dBFS).
 * Returns a new Float32Array (transferred from worker, zero-copy).
 */
export async function normalize(samples: Float32Array, targetDb = -0.1): Promise<Float32Array> {
  const id  = nextId()
  const res = await getWorkerPool().dispatch(
    { id, type: 'normalize', payload: { samples, targetDb } },
    [samples.buffer],
  ) as Extract<DSPResult, { type: 'normalize' }>
  return res.samples
}

/**
 * Resample samples to a target length using linear interpolation.
 * Returns a new Float32Array (transferred from worker, zero-copy).
 */
export async function resample(samples: Float32Array, targetLen: number): Promise<Float32Array> {
  const id  = nextId()
  const res = await getWorkerPool().dispatch(
    { id, type: 'resample', payload: { samples, targetLen } },
    [samples.buffer],
  ) as Extract<DSPResult, { type: 'resample' }>
  return res.samples
}

/**
 * Compute an N-point RMS waveform from raw PCM for display.
 * Default 200 points (matching the worker's typical usage).
 */
export async function waveform(samples: Float32Array, points = 200): Promise<number[]> {
  const id  = nextId()
  const res = await getWorkerPool().dispatch(
    { id, type: 'waveform', payload: { samples, points } },
    [samples.buffer],
  ) as Extract<DSPResult, { type: 'waveform' }>
  return res.data
}

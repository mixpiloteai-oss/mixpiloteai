export interface BenchmarkResult {
  sampleRate: number
  baseLatencyMs: number
  outputLatencyMs: number
  roundtripLatencyMs: number
  schedulerOverheadMs: number   // avg ms per simulated _onBeat with 10 tracks × 10 clips
  peakMeterFpsCapacity: number  // calls/sec for getLevel() style math on 256-sample buffer
  waveformPeaksMpps: number     // megasamples/sec for min/max/rms computation
  recommendation: 'low-latency' | 'standard' | 'power-saving'
}

export async function runAudioBenchmark(
  ctx: { baseLatency?: number; outputLatency?: number; sampleRate: number }
): Promise<BenchmarkResult> {
  const baseLatencyMs = ((ctx.baseLatency ?? 0) * 1000)
  const outputLatencyMs = ((ctx.outputLatency ?? 0) * 1000)
  const roundtripLatencyMs = baseLatencyMs + outputLatencyMs

  // Scheduler overhead benchmark: simulate 1000 iterations of beat loop math
  const ITERS = 1000
  const t0 = performance.now()
  for (let iter = 0; iter < ITERS; iter++) {
    // Simulate 10 tracks × 10 clips: compute beat math
    for (let t = 0; t < 10; t++) {
      for (let c = 0; c < 10; c++) {
        const clipStartBeat = (c + 1) * 4
        const clipEndBeat = clipStartBeat + 4
        const _overlap = clipEndBeat > 0 && clipStartBeat < 8
        const _dedupKey = `track${t}:clip${c}`
        void _dedupKey
        void _overlap
      }
    }
  }
  const schedulerOverheadMs = (performance.now() - t0) / ITERS

  // Peak meter benchmark: 10000 RMS computations on 256-sample buffer
  const buf = new Float32Array(256)
  for (let i = 0; i < 256; i++) buf[i] = Math.sin(i * 0.1) * 0.5
  const t1 = performance.now()
  const METER_ITERS = 10000
  for (let iter = 0; iter < METER_ITERS; iter++) {
    let sumSq = 0
    let peak = 0
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]!)
      sumSq += v * v
      if (v > peak) peak = v
    }
    void Math.sqrt(sumSq / buf.length)
    void peak
  }
  const meterElapsedMs = performance.now() - t1
  const peakMeterFpsCapacity = (METER_ITERS / meterElapsedMs) * 1000

  // Waveform peaks benchmark
  const samples = new Float32Array(44100)
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.01) * 0.8
  const BLOCK = 512
  const t2 = performance.now()
  let processed = 0
  for (let offset = 0; offset + BLOCK <= samples.length; offset += BLOCK) {
    let mn = 1, mx = -1, sumSq2 = 0
    for (let i = offset; i < offset + BLOCK; i++) {
      const v = samples[i]!
      if (v < mn) mn = v
      if (v > mx) mx = v
      sumSq2 += v * v
    }
    void Math.sqrt(sumSq2 / BLOCK)
    processed += BLOCK
  }
  const waveformElapsedMs = performance.now() - t2
  const waveformPeaksMpps = (processed / waveformElapsedMs) / 1000  // Msamples/s

  const recommendation: BenchmarkResult['recommendation'] =
    roundtripLatencyMs < 10 ? 'low-latency'
    : roundtripLatencyMs < 30 ? 'standard'
    : 'power-saving'

  return {
    sampleRate: ctx.sampleRate,
    baseLatencyMs,
    outputLatencyMs,
    roundtripLatencyMs,
    schedulerOverheadMs,
    peakMeterFpsCapacity,
    waveformPeaksMpps,
    recommendation,
  }
}

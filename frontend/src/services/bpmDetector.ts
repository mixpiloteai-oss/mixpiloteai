// ============================================================
// NEUROTEK AI — BPM Detector
// Onset detection + autocorrelation via Web Audio API
// ============================================================

export interface BpmResult {
  bpm: number;
  confidence: number; // 0–1
  method: 'tap' | 'autocorrelation' | 'onset';
}

// ── Tap tempo ────────────────────────────────────────────────
export class TapTempo {
  private taps: number[] = [];
  private readonly maxTaps = 8;
  private readonly timeoutMs = 3000;
  private lastTap = 0;

  tap(): BpmResult | null {
    const now = Date.now();
    if (now - this.lastTap > this.timeoutMs) this.taps = [];
    this.lastTap = now;
    this.taps.push(now);
    if (this.taps.length > this.maxTaps) this.taps.shift();

    if (this.taps.length < 2) return null;

    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avg);

    if (bpm < 60 || bpm > 300) return null;

    // confidence grows with number of taps
    const confidence = Math.min(1, (this.taps.length - 1) / (this.maxTaps - 1));

    return { bpm, confidence, method: 'tap' };
  }

  reset(): void { this.taps = []; }
}

// ── Realtime onset-based BPM ─────────────────────────────────
export class RealtimeBpmDetector {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private running = false;
  private onsets: number[] = [];
  private lastOnsetTime = 0;
  private prevEnergy = 0;
  private onResult: ((r: BpmResult) => void) | null = null;
  private rafId = 0;

  async startFromMic(onResult: (r: BpmResult) => void): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.ctx = new AudioContext({ sampleRate: 44100 });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.3;
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.onResult = onResult;
      this.running = true;
      this.detect();
      return true;
    } catch {
      return false;
    }
  }

  startFromAnalyser(analyser: AnalyserNode, ctx: AudioContext, onResult: (r: BpmResult) => void): void {
    this.analyser = analyser;
    this.ctx = ctx;
    this.onResult = onResult;
    this.running = true;
    this.detect();
  }

  private detect = (): void => {
    if (!this.running || !this.analyser || !this.ctx) return;

    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);

    // Sum low-frequency energy (kick band: 0–200 Hz)
    const binHz = (this.ctx.sampleRate / 2) / buf.length;
    const maxBin = Math.floor(200 / binHz);
    let energy = 0;
    for (let i = 0; i < maxBin; i++) energy += buf[i] * buf[i];
    energy /= maxBin;

    // Onset detection: energy spike above threshold
    const threshold = this.prevEnergy * 1.5 + 50;
    if (energy > threshold) {
      const now = performance.now();
      const gap = now - this.lastOnsetTime;
      if (gap > 200) { // min 200ms between onsets (max 300 BPM)
        this.onsets.push(now);
        if (this.onsets.length > 32) this.onsets.shift();
        this.lastOnsetTime = now;

        if (this.onsets.length >= 4) {
          const result = this.computeBpm();
          if (result && this.onResult) this.onResult(result);
        }
      }
    }

    this.prevEnergy = energy;
    this.rafId = requestAnimationFrame(this.detect);
  };

  private computeBpm(): BpmResult | null {
    if (this.onsets.length < 4) return null;

    const intervals = this.onsets.slice(1).map((t, i) => t - this.onsets[i]);

    // Autocorrelation over intervals to find dominant period
    const hist: Record<number, number> = {};
    intervals.forEach((iv) => {
      const rounded = Math.round(iv / 10) * 10; // 10ms buckets
      hist[rounded] = (hist[rounded] ?? 0) + 1;
    });

    let bestCount = 0;
    let bestIv = 500; // default: 120 BPM
    for (const [iv, count] of Object.entries(hist)) {
      if (count > bestCount) { bestCount = count; bestIv = Number(iv); }
    }

    const bpm = Math.round(60000 / bestIv);
    if (bpm < 60 || bpm > 300) return null;

    const confidence = Math.min(1, bestCount / Math.max(1, intervals.length));
    return { bpm, confidence, method: 'onset' };
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.source?.disconnect();
    this.ctx?.close();
    this.onsets = [];
  }
}

// ── Offline BPM analysis from AudioBuffer ────────────────────
export function analyseBufferBpm(buffer: AudioBuffer): BpmResult {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);

  // RMS energy in 10ms windows
  const windowSize = Math.floor(sampleRate * 0.01);
  const energies: number[] = [];

  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] ** 2;
    energies.push(Math.sqrt(sum / windowSize));
  }

  // Find onsets (energy peaks)
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const onsetFrames: number[] = [];
  let lastOnset = -10;

  for (let i = 2; i < energies.length - 2; i++) {
    if (
      energies[i] > mean * 1.5 &&
      energies[i] > energies[i - 1] &&
      energies[i] > energies[i + 1] &&
      i - lastOnset > 10
    ) {
      onsetFrames.push(i);
      lastOnset = i;
    }
  }

  if (onsetFrames.length < 4) return { bpm: 140, confidence: 0, method: 'autocorrelation' };

  const msPerFrame = 10;
  const intervals = onsetFrames.slice(1).map((f, i) => (f - onsetFrames[i]) * msPerFrame);

  // Histogram
  const hist: Record<number, number> = {};
  intervals.forEach((iv) => {
    const rounded = Math.round(iv / 5) * 5;
    hist[rounded] = (hist[rounded] ?? 0) + 1;
  });

  let bestIv = 428; // 140 BPM default
  let bestCount = 0;
  for (const [iv, count] of Object.entries(hist)) {
    if (count > bestCount) { bestCount = count; bestIv = Number(iv); }
  }

  let bpm = Math.round(60000 / bestIv);

  // Normalise to musical range (120–220 BPM range for tekno)
  while (bpm < 100) bpm *= 2;
  while (bpm > 250) bpm /= 2;

  const confidence = Math.min(1, bestCount / intervals.length);
  return { bpm, confidence, method: 'autocorrelation' };
}

// ── Warp engine: compute playback rate to sync to target BPM ─
export function computeWarpRate(sourceBpm: number, targetBpm: number): number {
  if (sourceBpm <= 0) return 1;
  return Math.max(0.25, Math.min(4, targetBpm / sourceBpm));
}

// ── Singleton tap tempo ───────────────────────────────────────
export const tapTempo = new TapTempo();
export const realtimeBpmDetector = new RealtimeBpmDetector();

// ============================================================
// NEUROTEK AI — Real Web Audio Engine
// AudioContext, beat clock, channel strips, master bus
// ============================================================

export type TrackType = 'kick' | 'bass' | 'melody' | 'fx' | 'percussion' | 'pad' | 'acid' | 'master' | 'arp' | 'vocal';

export interface ChannelStrip {
  id: string;
  name: string;
  type: TrackType;
  gain: GainNode;
  panner: StereoPannerNode;
  mute: GainNode;
  solo: boolean;
  muted: boolean;
  volume: number;  // 0–1
  pan: number;     // -1 to 1
  analyser: AnalyserNode;
}

export interface MasterBus {
  compressor: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  masterGain: GainNode;
  analyser: AnalyserNode;
  destination: AudioDestinationNode;
}

export interface BeatClock {
  bpm: number;
  isRunning: boolean;
  position: number;    // bars
  beat: number;        // 0–3 within bar
  subdivision: number; // 0–3 within beat (16th notes)
  nextBeatTime: number;
  startTime: number;
}

export interface EngineState {
  isInitialised: boolean;
  isPlaying: boolean;
  bpm: number;
  masterVolume: number;
  latencyMs: number;
  sampleRate: number;
  cpuLoad: number;
  overload: boolean;
}

const LOOK_AHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

class RealAudioEngine {
  private ctx: AudioContext | null = null;
  private masterBus: MasterBus | null = null;
  private channels: Map<string, ChannelStrip> = new Map();
  private clock: BeatClock = {
    bpm: 140, isRunning: false, position: 0,
    beat: 0, subdivision: 0, nextBeatTime: 0, startTime: 0,
  };
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: EngineState) => void> = new Set();
  private beatListeners: Set<(beat: number, bar: number) => void> = new Set();
  private cpuEstimate = 0;
  private meterNode: AudioWorkletNode | null = null;
  private meterCallback: ((l: number, r: number, peak: number, clip: boolean) => void) | null = null;

  // ── Init ────────────────────────────────────────────────────
  async init(): Promise<void> {
    if (this.ctx) return;

    this.ctx = new AudioContext({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterBus = this.buildMasterBus(this.ctx);
    await this.initWorklets(this.ctx);
    this.emit();
  }

  private async initWorklets(ctx: AudioContext): Promise<void> {
    try {
      await ctx.audioWorklet.addModule('/worklets/meter-processor.js');
      this.meterNode = new AudioWorkletNode(ctx, 'meter-processor');
      this.meterNode.port.onmessage = (e) => {
        const { peakL, peakR, rmsL, rmsR, clip } = e.data;
        const peak = Math.max(peakL, peakR);
        this.meterCallback?.(rmsL, rmsR, peak, clip);
      };
      if (this.masterBus) {
        this.masterBus.analyser.connect(this.meterNode);
        this.meterNode.connect(ctx.destination);
      }
    } catch {
      // AudioWorklet not supported or worklet file missing — fall back silently
    }
  }

  private buildMasterBus(ctx: AudioContext): MasterBus {
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    masterGain.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    return { compressor, limiter, masterGain, analyser, destination: ctx.destination };
  }

  // ── Channel strips ──────────────────────────────────────────
  createChannel(id: string, name: string, type: TrackType): ChannelStrip {
    if (!this.ctx || !this.masterBus) throw new Error('Engine not initialised');

    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    const mute = this.ctx.createGain();
    mute.gain.value = 1;

    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;

    gain.connect(panner);
    panner.connect(mute);
    mute.connect(analyser);
    analyser.connect(this.masterBus.masterGain);

    const strip: ChannelStrip = {
      id, name, type, gain, panner, mute, analyser,
      solo: false, muted: false, volume: 0.8, pan: 0,
    };

    this.channels.set(id, strip);
    return strip;
  }

  removeChannel(id: string): void {
    const ch = this.channels.get(id);
    if (!ch) return;
    ch.gain.disconnect();
    ch.panner.disconnect();
    ch.mute.disconnect();
    ch.analyser.disconnect();
    this.channels.delete(id);
  }

  setChannelVolume(id: string, vol: number): void {
    const ch = this.channels.get(id);
    if (!ch || !this.ctx) return;
    ch.volume = vol;
    ch.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.01);
  }

  setChannelPan(id: string, pan: number): void {
    const ch = this.channels.get(id);
    if (!ch || !this.ctx) return;
    ch.pan = pan;
    ch.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.005);
  }

  setChannelMute(id: string, muted: boolean): void {
    const ch = this.channels.get(id);
    if (!ch || !this.ctx) return;
    ch.muted = muted;
    ch.mute.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.005);
  }

  setChannelSolo(id: string, solo: boolean): void {
    const ch = this.channels.get(id);
    if (!ch) return;
    ch.solo = solo;
    const anySolo = [...this.channels.values()].some((c) => c.solo);
    this.channels.forEach((c) => {
      if (!this.ctx) return;
      const shouldHear = !anySolo || c.solo;
      c.mute.gain.setTargetAtTime(
        c.muted ? 0 : shouldHear ? 1 : 0,
        this.ctx.currentTime,
        0.005,
      );
    });
  }

  // ── Beat clock / scheduler ──────────────────────────────────
  start(): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.clock.isRunning = true;
    this.clock.startTime = this.ctx.currentTime;
    this.clock.nextBeatTime = this.ctx.currentTime;
    this.clock.beat = 0;
    this.clock.position = 0;

    this.schedulerTimer = setInterval(() => this.schedule(), LOOK_AHEAD_MS);
    this.emit();
  }

  stop(): void {
    this.clock.isRunning = false;
    this.clock.beat = 0;
    this.clock.position = 0;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.emit();
  }

  private schedule(): void {
    if (!this.ctx || !this.clock.isRunning) return;

    const beatDuration = 60 / this.clock.bpm;

    while (this.clock.nextBeatTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.fireBeat(this.clock.beat, Math.floor(this.clock.position));
      this.clock.nextBeatTime += beatDuration;
      this.clock.beat = (this.clock.beat + 1) % 4;
      if (this.clock.beat === 0) this.clock.position++;
    }

    const bufferSize = this.ctx.baseLatency * this.ctx.sampleRate;
    this.cpuEstimate = Math.min(100, (bufferSize / 512) * 5 + Math.random() * 3);
    this.emit();
  }

  private fireBeat(beat: number, bar: number): void {
    this.beatListeners.forEach((fn) => fn(beat, bar));
  }

  setBpm(bpm: number): void {
    this.clock.bpm = Math.max(60, Math.min(300, bpm));
    this.emit();
  }

  setMasterVolume(vol: number): void {
    if (!this.ctx || !this.masterBus) return;
    this.masterBus.masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, vol)) * 0.9,
      this.ctx.currentTime,
      0.02,
    );
    this.emit();
  }

  async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(arr);
    } catch (e) {
      console.warn('[AudioEngine] Failed to load buffer:', e);
      return null;
    }
  }

  playBuffer(
    buffer: AudioBuffer,
    channelId: string,
    opts: { loop?: boolean; offset?: number; rate?: number } = {},
  ): AudioBufferSourceNode | null {
    const ch = this.channels.get(channelId);
    if (!this.ctx || !ch) return null;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = opts.loop ?? false;
    src.playbackRate.value = opts.rate ?? 1;
    src.connect(ch.gain);
    src.start(0, opts.offset ?? 0);
    return src;
  }

  synthesisKick(
    channelId: string,
    opts: { freq?: number; decay?: number; distortion?: number } = {},
  ): void {
    if (!this.ctx) return;
    const ch = this.channels.get(channelId);
    const out = ch ? ch.gain : this.masterBus?.masterGain;
    if (!out) return;

    const { freq = 60, decay = 0.35, distortion = 0 } = opts;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 3, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.04);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(1, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);

    if (distortion > 0) {
      const wave = this.ctx.createWaveShaper();
      wave.curve = makeDistortionCurve(distortion * 400) as unknown as Float32Array<ArrayBuffer>;
      osc.connect(wave);
      wave.connect(env);
    } else {
      osc.connect(env);
    }

    env.connect(out);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  synthesisRumble(channelId: string, durationS = 2): void {
    if (!this.ctx) return;
    const ch = this.channels.get(channelId);
    const out = ch ? ch.gain : this.masterBus?.masterGain;
    if (!out) return;

    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * durationS, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 80;
    filter.Q.value = 2;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + durationS);

    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(now);
    noise.stop(now + durationS);
  }

  synthesisAcidBass(
    channelId: string,
    opts: { freq?: number; cutoff?: number; resonance?: number; duration?: number } = {},
  ): void {
    if (!this.ctx) return;
    const ch = this.channels.get(channelId);
    const out = ch ? ch.gain : this.masterBus?.masterGain;
    if (!out) return;

    const { freq = 110, cutoff = 800, resonance = 15, duration = 0.2 } = opts;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 3, now);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.5, now + duration);
    filter.Q.value = resonance;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.7, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05);

    osc.connect(filter);
    filter.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  getMasterSpectrum(): Float32Array | null {
    if (!this.masterBus) return null;
    const buf = new Float32Array(this.masterBus.analyser.frequencyBinCount);
    this.masterBus.analyser.getFloatFrequencyData(buf);
    return buf;
  }

  getMasterWaveform(): Uint8Array | null {
    if (!this.masterBus) return null;
    const buf = new Uint8Array(this.masterBus.analyser.frequencyBinCount);
    this.masterBus.analyser.getByteTimeDomainData(buf);
    return buf;
  }

  getChannelLevel(id: string): number {
    const ch = this.channels.get(id);
    if (!ch) return 0;
    const buf = new Uint8Array(ch.analyser.frequencyBinCount);
    ch.analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  onStateChange(fn: (state: EngineState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onBeat(fn: (beat: number, bar: number) => void): () => void {
    this.beatListeners.add(fn);
    return () => this.beatListeners.delete(fn);
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState(): EngineState {
    return {
      isInitialised: !!this.ctx,
      isPlaying: this.clock.isRunning,
      bpm: this.clock.bpm,
      masterVolume: this.masterBus
        ? this.masterBus.masterGain.gain.value / 0.9
        : 0.85,
      latencyMs: this.ctx
        ? (this.ctx.baseLatency + (this.ctx.outputLatency ?? 0)) * 1000
        : 0,
      sampleRate: this.ctx?.sampleRate ?? 48000,
      cpuLoad: this.cpuEstimate,
      overload: this.cpuEstimate > 85,
    };
  }

  get audioContext(): AudioContext | null { return this.ctx; }
  get masterInput(): GainNode | null { return this.masterBus?.masterGain ?? null; }
  get currentBeat(): number { return this.clock.beat; }
  get currentBar(): number { return this.clock.position; }
  get bpm(): number { return this.clock.bpm; }

  onMeter(fn: (l: number, r: number, peak: number, clip: boolean) => void): () => void {
    this.meterCallback = fn;
    return () => { if (this.meterCallback === fn) this.meterCallback = null; };
  }

  async close(): Promise<void> {
    this.stop();
    this.meterNode?.disconnect();
    this.meterNode = null;
    this.channels.clear();
    if (this.ctx) { await this.ctx.close(); this.ctx = null; }
  }
}

function makeDistortionCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export const audioEngine = new RealAudioEngine();
export default audioEngine;

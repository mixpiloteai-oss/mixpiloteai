// ============================================================
// NEUROTEK AI — Mixer Engine
// Web Audio API: per-channel EQ, compression, reverb & delay
// ============================================================

import { audioEngine } from './realAudioEngine';

// ─── Config types ────────────────────────────────────────────

export interface EQBandConfig {
  freq: number;
  gain: number;
  q: number;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  enabled: boolean;
}

export interface CompressorConfig {
  threshold: number;  // dB
  ratio: number;
  attack: number;     // ms
  release: number;    // ms
  makeupGain: number; // dB (applied as a downstream GainNode if needed)
  enabled: boolean;
}

export interface MixChannelConfig {
  volume: number;
  pan: number;
  eq: [EQBandConfig, EQBandConfig, EQBandConfig];
  compressor: CompressorConfig;
  reverbSend: number;
  delaySend: number;
}

// ─── Internal node bundle ────────────────────────────────────

interface ChannelNodes {
  eq: [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode];
  compressor: DynamicsCompressorNode;
  volume: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
}

// ─── MixerEngine class ───────────────────────────────────────

class MixerEngine {
  private channels = new Map<string, ChannelNodes>();

  // FX buses
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayGain: GainNode | null = null;

  // ── FX bus initialisation ─────────────────────────────────

  async initFX(): Promise<void> {
    const ctx = audioEngine.audioContext;
    const master = audioEngine.masterInput;
    if (!ctx || !master) return;

    // --- Reverb ---
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.generateIR(ctx, 2);

    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.3;

    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(master);

    // --- Delay ---
    const delayTime = (60 / audioEngine.bpm) * 0.75;

    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = delayTime;

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.4;

    // Feedback loop: delay → feedback → delay
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);

    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.3;

    this.delay.connect(this.delayGain);
    this.delayGain.connect(master);
  }

  // ── Channel initialisation ────────────────────────────────

  initChannel(id: string, channel: MixChannelConfig): void {
    const ctx = audioEngine.audioContext;
    const master = audioEngine.masterInput;
    if (!ctx || !master) return;

    // EQ bands: lowshelf → peaking → highshelf
    const eqTypes: Array<BiquadFilterType> = ['lowshelf', 'peaking', 'highshelf'];
    const eq = eqTypes.map((t) => {
      const f = ctx.createBiquadFilter();
      f.type = t;
      return f;
    }) as [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode];

    // Dynamics compressor
    const compressor = ctx.createDynamicsCompressor();

    // Volume fader
    const volume = ctx.createGain();
    volume.gain.value = channel.volume;

    // Signal chain: eq[0] → eq[1] → eq[2] → compressor → volume → master
    eq[0].connect(eq[1]);
    eq[1].connect(eq[2]);
    eq[2].connect(compressor);
    compressor.connect(volume);
    volume.connect(master);

    // Reverb send
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = channel.reverbSend;
    if (this.reverb) {
      volume.connect(reverbSend);
      reverbSend.connect(this.reverb);
    }

    // Delay send
    const delaySend = ctx.createGain();
    delaySend.gain.value = channel.delaySend;
    if (this.delay) {
      volume.connect(delaySend);
      delaySend.connect(this.delay);
    }

    const nodes: ChannelNodes = { eq, compressor, volume, reverbSend, delaySend };
    this.channels.set(id, nodes);

    // Apply initial parameter values
    this.applyEQ(nodes, channel.eq);
    this.applyCompressor(nodes, channel.compressor);
  }

  // ── EQ ────────────────────────────────────────────────────

  updateEQ(channelId: string, bands: EQBandConfig[]): void {
    const nodes = this.channels.get(channelId);
    if (!nodes) return;
    this.applyEQ(nodes, bands);
  }

  private applyEQ(nodes: ChannelNodes, bands: EQBandConfig[]): void {
    bands.forEach((band, i) => {
      if (i >= nodes.eq.length) return;
      const filter = nodes.eq[i];
      filter.frequency.value = band.freq;
      filter.Q.value = band.q;
      filter.gain.value = band.enabled ? band.gain : 0;
    });
  }

  // ── Compressor ────────────────────────────────────────────

  updateCompressor(channelId: string, settings: CompressorConfig): void {
    const nodes = this.channels.get(channelId);
    if (!nodes) return;
    this.applyCompressor(nodes, settings);
  }

  private applyCompressor(nodes: ChannelNodes, settings: CompressorConfig): void {
    const comp = nodes.compressor;

    if (!settings.enabled) {
      // Pass-through: disable compression without disconnecting
      comp.threshold.value = 0;
      comp.ratio.value = 1;
    } else {
      comp.threshold.value = settings.threshold;
      comp.ratio.value = settings.ratio;
      comp.attack.value = settings.attack / 1000;
      comp.release.value = settings.release / 1000;
      comp.knee.value = 6; // sensible default
    }
  }

  // ── Volume ────────────────────────────────────────────────

  setVolume(channelId: string, vol: number): void {
    const ctx = audioEngine.audioContext;
    const nodes = this.channels.get(channelId);
    if (!ctx || !nodes) return;
    nodes.volume.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }

  // ── Send levels ───────────────────────────────────────────

  setSend(channelId: string, type: 'reverb' | 'delay', val: number): void {
    const ctx = audioEngine.audioContext;
    const nodes = this.channels.get(channelId);
    if (!ctx || !nodes) return;

    const sendNode = type === 'reverb' ? nodes.reverbSend : nodes.delaySend;
    sendNode.gain.setTargetAtTime(val, ctx.currentTime, 0.02);
  }

  // ── Metering ──────────────────────────────────────────────

  /**
   * Returns the current gain reduction in dB (≤ 0).
   * Web Audio's DynamicsCompressorNode exposes this via .reduction.
   */
  getGainReduction(channelId: string): number {
    const nodes = this.channels.get(channelId);
    if (!nodes) return 0;
    return nodes.compressor.reduction;
  }

  // ── Cleanup ───────────────────────────────────────────────

  dispose(): void {
    this.channels.forEach((nodes) => {
      nodes.eq.forEach((f) => f.disconnect());
      nodes.compressor.disconnect();
      nodes.volume.disconnect();
      nodes.reverbSend.disconnect();
      nodes.delaySend.disconnect();
    });
    this.channels.clear();

    this.reverb?.disconnect();
    this.reverbGain?.disconnect();
    this.delay?.disconnect();
    this.delayFeedback?.disconnect();
    this.delayGain?.disconnect();

    this.reverb = null;
    this.reverbGain = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayGain = null;
  }

  // ── Private helpers ───────────────────────────────────────

  /**
   * Generate a simple synthetic impulse response for the reverb convolver.
   * Uses exponentially decaying white noise.
   */
  private generateIR(ctx: AudioContext, duration: number): AudioBuffer {
    const len = ctx.sampleRate * duration;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }

    return ir;
  }
}

// ─── Singleton export ─────────────────────────────────────────

export const mixerEngine = new MixerEngine();

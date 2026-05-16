/**
 * NEUROTEK AI — Meter Processor AudioWorklet
 * Off-main-thread peak + RMS metering for all channels.
 * Runs inside AudioContext at hardware buffer size (typically 128 samples).
 */
class MeterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  constructor() {
    super();
    this._peakL = 0;
    this._peakR = 0;
    this._rmsL = 0;
    this._rmsR = 0;
    this._hold = 0;
    this._holdFrames = 0;
    this._clip = false;
    // Report every ~20ms (at 48kHz/128 samples = ~375 blocks/s, ~7-8 blocks per report)
    this._reportInterval = 8;
    this._blockCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const L = input[0] ?? new Float32Array(128);
    const R = input[1] ?? L;
    const len = L.length;

    let peakL = 0, peakR = 0, sumSqL = 0, sumSqR = 0;

    for (let i = 0; i < len; i++) {
      const absL = Math.abs(L[i]);
      const absR = Math.abs(R[i]);
      if (absL > peakL) peakL = absL;
      if (absR > peakR) peakR = absR;
      sumSqL += L[i] * L[i];
      sumSqR += R[i] * R[i];
    }

    const rmsL = Math.sqrt(sumSqL / len);
    const rmsR = Math.sqrt(sumSqR / len);

    // Smooth decay: 0.95 per block ~= fast enough
    this._peakL = Math.max(peakL, this._peakL * 0.95);
    this._peakR = Math.max(peakR, this._peakR * 0.95);
    this._rmsL  = Math.max(rmsL,  this._rmsL  * 0.90);
    this._rmsR  = Math.max(rmsR,  this._rmsR  * 0.90);

    if (this._peakL > 0.99 || this._peakR > 0.99) this._clip = true;

    this._blockCount++;
    if (this._blockCount >= this._reportInterval) {
      this._blockCount = 0;
      this.port.postMessage({
        peakL: this._peakL,
        peakR: this._peakR,
        rmsL:  this._rmsL,
        rmsR:  this._rmsR,
        clip:  this._clip,
      });
      this._clip = false;
    }

    return true;
  }
}

registerProcessor('meter-processor', MeterProcessor);

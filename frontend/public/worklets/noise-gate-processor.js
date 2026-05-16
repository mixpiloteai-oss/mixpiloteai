/**
 * NEUROTEK AI — Noise Gate AudioWorklet Processor
 * Off-main-thread noise gate with adjustable threshold, attack, and release.
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: 0.01, minValue: 0, maxValue: 1 },
      { name: 'attack',    defaultValue: 0.01, minValue: 0.001, maxValue: 1 },
      { name: 'release',   defaultValue: 0.1,  minValue: 0.001, maxValue: 2 },
    ];
  }

  constructor() {
    super();
    this._gain = 0;
    this._isOpen = false;
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const threshold = parameters.threshold[0];
    const attack    = parameters.attack[0];
    const release   = parameters.release[0];

    // Time constants per sample
    const sRate       = sampleRate;
    const attackCoef  = Math.exp(-1 / (sRate * attack));
    const releaseCoef = Math.exp(-1 / (sRate * release));

    for (let ch = 0; ch < input.length; ch++) {
      const inp = input[ch];
      const out = output[ch];
      for (let i = 0; i < inp.length; i++) {
        const level = Math.abs(inp[i]);
        if (level > threshold) {
          this._gain = 1 - (1 - this._gain) * attackCoef;
        } else {
          this._gain = this._gain * releaseCoef;
        }
        out[i] = inp[i] * this._gain;
      }
    }
    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);

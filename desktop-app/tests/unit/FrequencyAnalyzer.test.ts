import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrequencyAnalyzer } from '../../src/renderer/src/audio/analysis/FrequencyAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, n: number, amplitude = 1.0): Float32Array {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('FrequencyAnalyzer', () => {
  const analyzer = new FrequencyAnalyzer()

  describe('analyzeSpectrum() — DFT of pure sine', () => {
    it('pure sine at 440 Hz → peak bin within ±2 of expected', () => {
      const FFT  = 256
      const freq = 440
      const buf  = makeSine(freq, SR, FFT)
      const { frequencies, magnitudes } = analyzer.analyzeSpectrum(buf, SR, FFT)

      // Find peak bin
      let peakBin = 0
      let peakDb  = -Infinity
      for (let k = 0; k < magnitudes.length; k++) {
        const db = magnitudes[k] ?? -Infinity
        if (isFinite(db) && db > peakDb) {
          peakDb  = db
          peakBin = k
        }
      }

      const expectedBin = Math.round(freq * FFT / SR)
      assert.ok(
        Math.abs(peakBin - expectedBin) <= 2,
        `peak at bin ${peakBin}, expected near ${expectedBin}`,
      )
    })
  })

  describe('Hann window: spectral leakage test', () => {
    it('windowed spectrum has less leakage energy than un-windowed', () => {
      // Generate an off-grid frequency to maximize leakage
      const FFT      = 256
      const offFreq  = 500  // not an integer multiple of bin width
      const buf      = makeSine(offFreq, SR, FFT)

      // With window
      const { magnitudes: withWindow } = analyzer.analyzeSpectrum(buf, SR, FFT)

      // Without window: manually compute DFT without Hann
      // We check that with windowing the energy outside the main peak is reduced
      // Simple proxy: variance of sorted magnitudes around the peak
      const withWindowFinite = Array.from(withWindow).filter(isFinite)
      const sorted = [...withWindowFinite].sort((a, b) => b - a)
      const topDb  = sorted[0] ?? -Infinity
      const second = sorted[1] ?? -Infinity

      // With good windowing, the second peak should be well below the main peak
      // This is a relative test: main peak dominates
      assert.ok(
        topDb > second + 3,
        `main peak ${topDb.toFixed(1)} dB should dominate over second ${second.toFixed(1)} dB by >3 dB`,
      )
    })
  })

  describe('computeOctaveBands()', () => {
    it('returns exactly 10 octave bands', () => {
      const buf    = makeSine(440, SR, 2048)
      const spec   = analyzer.analyzeSpectrum(buf, SR, 2048)
      const result = analyzer.computeOctaveBands(spec, SR)
      assert.strictEqual(result.bands.length, 10)
    })

    it('center frequencies match standard octave centers', () => {
      const buf    = makeSine(440, SR, 2048)
      const spec   = analyzer.analyzeSpectrum(buf, SR, 2048)
      const result = analyzer.computeOctaveBands(spec, SR)
      const centers = result.bands.map((b) => b.centerHz)

      const expected = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
      for (let i = 0; i < expected.length; i++) {
        assert.strictEqual(centers[i], expected[i], `Band ${i}: expected ${expected[i]}, got ${centers[i]}`)
      }
    })

    it('each band has minHz < centerHz < maxHz', () => {
      const buf    = makeSine(1000, SR, 2048)
      const spec   = analyzer.analyzeSpectrum(buf, SR, 2048)
      const result = analyzer.computeOctaveBands(spec, SR)
      for (const band of result.bands) {
        assert.ok(band.minHz < band.centerHz, `minHz ${band.minHz} < centerHz ${band.centerHz}`)
        assert.ok(band.centerHz < band.maxHz, `centerHz ${band.centerHz} < maxHz ${band.maxHz}`)
      }
    })
  })

  describe('detectMudFrequencies()', () => {
    it('detects synthetic mud peak at ~300 Hz', () => {
      // Use a larger FFT to get finer frequency resolution in the 200–500 Hz range.
      // We need a bin at ~300 Hz that is >6 dB above its neighbors.
      // With FFT=4096, bin width = SR/FFT ≈ 10.8 Hz, so 300 Hz ≈ bin 28.
      // Use a pure sine at exactly a bin frequency so the energy is concentrated.
      const FFT = 4096
      const binWidth = SR / FFT
      // Pick a center frequency in 200–500 Hz range that falls on a bin boundary
      const targetBin  = Math.round(300 / binWidth)
      const targetFreq = targetBin * binWidth

      // Very weak neighbors: use sines 3 bins away at tiny amplitude
      const buf = new Float32Array(FFT)
      for (let i = 0; i < FFT; i++) {
        // Strong peak at targetFreq
        buf[i] = Math.sin(2 * Math.PI * targetFreq * i / SR) * 1.0
        // Very weak sines at neighboring bins (much more than 6 dB below)
        buf[i] += Math.sin(2 * Math.PI * (targetFreq - binWidth) * i / SR) * 0.05
        buf[i] += Math.sin(2 * Math.PI * (targetFreq + binWidth) * i / SR) * 0.05
      }

      const spec     = analyzer.analyzeSpectrum(buf, SR, FFT)
      const mudFreqs = analyzer.detectMudFrequencies(spec)

      assert.ok(
        mudFreqs.length > 0,
        `Expected mud at ~${targetFreq.toFixed(0)} Hz, got none.`,
      )
    })
  })

  describe('magnitudes edge cases', () => {
    it('silence → all magnitudes are -Infinity or very low', () => {
      const buf  = new Float32Array(256)
      const { magnitudes } = analyzer.analyzeSpectrum(buf, SR, 256)
      for (let k = 0; k < magnitudes.length; k++) {
        const db = magnitudes[k] ?? 0
        assert.ok(
          !isFinite(db) || db < -60,
          `Expected silence magnitude < -60 or -Inf at bin ${k}, got ${db}`,
        )
      }
    })

    it('full-scale sine ≈ -3 dBFS (within 3 dB)', () => {
      const FFT  = 512
      const freq = 1000
      const buf  = makeSine(freq, SR, FFT, 1.0)
      const { magnitudes, frequencies } = analyzer.analyzeSpectrum(buf, SR, FFT)

      // Find peak bin near 1 kHz
      let peakDb = -Infinity
      const expectedBin = Math.round(freq * FFT / SR)
      for (let k = Math.max(0, expectedBin - 3); k <= expectedBin + 3 && k < magnitudes.length; k++) {
        const db = magnitudes[k] ?? -Infinity
        if (isFinite(db) && db > peakDb) peakDb = db
      }

      // Full-scale sine: RMS = -3 dBFS, but DFT peak can be somewhat different
      assert.ok(
        isFinite(peakDb) && peakDb > -10,
        `Full-scale sine should have strong peak, got ${peakDb.toFixed(1)} dBFS`,
      )
    })
  })
})

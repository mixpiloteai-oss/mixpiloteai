export type StyleTag =
  | 'kick' | 'snare' | 'hihat' | 'clap' | 'percussion' | 'drum-loop'
  | 'bass' | 'sub-bass' | 'bass-loop'
  | 'lead' | 'pad' | 'chord' | 'arp' | 'melodic'
  | 'fx' | 'noise' | 'riser' | 'downlifter' | 'impact' | 'sweep'
  | 'vocal' | 'spoken' | 'choir'
  | 'loop' | 'one-shot'
  | 'acoustic' | 'electronic'
  | 'ambient' | 'techno' | 'house' | 'dnb' | 'hiphop' | 'trap'

interface AudioFeatures {
  rms:              number  // overall loudness
  zeroCrossRate:    number  // high = noisy/percussive
  spectralCentroid: number  // brightness (Hz)
  lowEnergyRatio:   number  // energy below 200Hz / total
  highEnergyRatio:  number  // energy above 4kHz / total
  transientCount:   number  // number of detected onsets
  duration:         number
  isPercussive:     boolean // transientCount/duration > threshold
  isShort:          boolean // duration < 1s
}

export class StyleClassifier {
  classify(buffer: AudioBuffer, filename: string): StyleTag[] {
    if (buffer.length === 0) return []
    try {
      const features = this._extractFeatures(buffer)
      return this._applyRules(features, filename)
    } catch {
      return []
    }
  }

  private _extractFeatures(buffer: AudioBuffer): AudioFeatures {
    const data       = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const n          = data.length
    const duration   = buffer.duration

    // RMS
    let sumSq = 0
    for (let i = 0; i < n; i++) sumSq += (data[i] ?? 0) ** 2
    const rms = Math.sqrt(sumSq / n)

    // Zero crossing rate
    let zc = 0
    for (let i = 1; i < n; i++) {
      if ((data[i]! >= 0) !== (data[i - 1]! >= 0)) zc++
    }
    const zeroCrossRate = zc / n

    // Spectral centroid (via FFT approximation using chunk power distribution)
    const fftSize    = 1024
    const half       = fftSize / 2
    const powerBins  = new Float32Array(half)
    let totalPower   = 0
    const numFrames  = Math.floor(n / fftSize)
    for (let f = 0; f < numFrames && f < 32; f++) {
      for (let k = 0; k < half; k++) {
        // Compute DFT at bin k
        let re = 0, im = 0
        for (let t = 0; t < fftSize; t++) {
          const angle = -2 * Math.PI * k * t / fftSize
          re += (data[f * fftSize + t] ?? 0) * Math.cos(angle)
          im += (data[f * fftSize + t] ?? 0) * Math.sin(angle)
        }
        const p = re * re + im * im
        powerBins[k] = (powerBins[k] ?? 0) + p
        totalPower += p
      }
    }
    let centroidNum = 0
    for (let k = 0; k < half; k++) {
      const freq = k * sampleRate / fftSize
      centroidNum += freq * (powerBins[k] ?? 0)
    }
    const spectralCentroid = totalPower > 0 ? centroidNum / totalPower : 1000

    // Low/high energy ratio (use FFT bin ranges)
    const lowBin  = Math.floor(200  * fftSize / sampleRate)
    const highBin = Math.floor(4000 * fftSize / sampleRate)
    let lowEnergy = 0, highEnergy = 0
    for (let k = 0; k < lowBin && k < half; k++)  lowEnergy  += powerBins[k] ?? 0
    for (let k = highBin; k < half; k++)            highEnergy += powerBins[k] ?? 0
    const lowEnergyRatio  = totalPower > 0 ? lowEnergy  / totalPower : 0
    const highEnergyRatio = totalPower > 0 ? highEnergy / totalPower : 0

    // Transient count (simple onset detection: energy jump)
    let transientCount = 0
    const hopSamples   = Math.floor(sampleRate * 0.01) // 10ms
    let prevEnergy     = 0
    for (let i = 0; i + hopSamples < n; i += hopSamples) {
      let e = 0
      for (let j = 0; j < hopSamples; j++) e += (data[i + j] ?? 0) ** 2
      e /= hopSamples
      if (e > prevEnergy * 3 && e > 0.01) transientCount++
      prevEnergy = e
    }

    return {
      rms, zeroCrossRate, spectralCentroid,
      lowEnergyRatio, highEnergyRatio,
      transientCount, duration,
      isPercussive: transientCount / duration > 2,
      isShort:      duration < 1.0,
    }
  }

  private _applyRules(f: AudioFeatures, filename: string): StyleTag[] {
    const tags = new Set<StyleTag>()
    const lower = filename.toLowerCase()

    // Filename keywords
    if (/kick|bd|bass.?drum/.test(lower))   tags.add('kick')
    if (/snare|sd/.test(lower))             tags.add('snare')
    if (/hi.?hat|hh|hihat/.test(lower))     tags.add('hihat')
    if (/clap/.test(lower))                 tags.add('clap')
    if (/loop/.test(lower))                 tags.add('loop')
    if (/one.?shot/.test(lower))            tags.add('one-shot')
    if (/bass/.test(lower))                 tags.add('bass')
    if (/pad/.test(lower))                  tags.add('pad')
    if (/lead/.test(lower))                 tags.add('lead')
    if (/chord/.test(lower))                tags.add('chord')
    if (/arp/.test(lower))                  tags.add('arp')
    if (/vox|vocal/.test(lower))            tags.add('vocal')
    if (/riser/.test(lower))                tags.add('riser')
    if (/fx|effect/.test(lower))            tags.add('fx')
    if (/sweep/.test(lower))                tags.add('sweep')
    if (/techno/.test(lower))               tags.add('techno')
    if (/house/.test(lower))                tags.add('house')
    if (/dnb|drum.?bass/.test(lower))       tags.add('dnb')
    if (/hip.?hop|hiphop/.test(lower))      tags.add('hiphop')
    if (/trap/.test(lower))                 tags.add('trap')
    if (/ambient/.test(lower))              tags.add('ambient')

    // Audio feature rules
    if (f.isShort && f.isPercussive)                          tags.add('one-shot')
    if (f.duration > 1.5 && f.isPercussive)                   tags.add('drum-loop')
    if (f.lowEnergyRatio > 0.6 && f.spectralCentroid < 300)  { tags.add('sub-bass'); tags.add('bass') }
    if (f.spectralCentroid > 3000 && f.highEnergyRatio > 0.3) tags.add('hihat')
    if (f.zeroCrossRate > 0.3)                                tags.add('noise')
    if (f.duration > 2 && !f.isPercussive)                    tags.add('loop')
    if (!tags.has('drum-loop') && !tags.has('one-shot') && !f.isPercussive && f.duration > 1)
      tags.add('melodic')
    if (f.spectralCentroid < 200 && f.lowEnergyRatio > 0.7)   tags.add('kick')
    if (f.isPercussive && f.spectralCentroid > 500 && f.isShort) tags.add('percussion')
    if (!f.isPercussive && f.duration > 3)                     tags.add('pad')
    if (f.lowEnergyRatio < 0.2 && f.highEnergyRatio < 0.2 && !f.isPercussive) tags.add('lead')

    return [...tags]
  }
}

let _instance: StyleClassifier | null = null

export function getStyleClassifier(): StyleClassifier {
  if (!_instance) _instance = new StyleClassifier()
  return _instance
}

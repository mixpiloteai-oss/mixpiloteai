import type { SampleEntry } from './types'

export interface Recommendation {
  entry:  SampleEntry
  score:  number  // 0-1
  reason: string  // e.g. "Similar BPM and key"
}

export class SampleRecommender {
  recommend(
    reference: SampleEntry,
    candidates: SampleEntry[],
    maxResults: number,
  ): Recommendation[] {
    return candidates
      .filter(c => c.id !== reference.id)
      .map(c => {
        const { score, reason } = this.score(reference, c)
        return { entry: c, score, reason }
      })
      .filter(r => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
  }

  score(a: SampleEntry, b: SampleEntry): { score: number; reason: string } {
    if (a.id === b.id) return { score: 0, reason: '' }

    let s = 0
    const reasons: string[] = []

    // Same key: +0.35
    if (a.key && b.key && a.key === b.key) {
      s += 0.35; reasons.push('Same key')
    }
    // Compatible key (same root): +0.15
    else if (a.key && b.key && a.key.split(' ')[0] === b.key.split(' ')[0]) {
      s += 0.15; reasons.push('Same root note')
    }

    // BPM similarity: max +0.30
    if (a.bpm !== null && b.bpm !== null) {
      const diff    = Math.abs(a.bpm - b.bpm)
      const halfB   = Math.abs(a.bpm - b.bpm * 2)
      const doubleB = Math.abs(a.bpm - b.bpm / 2)
      const minDiff = Math.min(diff, halfB, doubleB)
      if (minDiff < 2)       { s += 0.30; reasons.push('Matching BPM') }
      else if (minDiff < 5)  { s += 0.20; reasons.push('Similar BPM') }
      else if (minDiff < 10) { s += 0.10; reasons.push('Close BPM') }
    }

    // Shared style tags: up to +0.25
    if (a.style.length > 0 && b.style.length > 0) {
      const shared  = a.style.filter(t => b.style.includes(t)).length
      const union   = new Set([...a.style, ...b.style]).size
      const jaccard = shared / union
      s += jaccard * 0.25
      if (shared > 0) reasons.push(`${shared} shared tags`)
    }

    // Duration similarity: max +0.10
    if (a.duration > 0 && b.duration > 0) {
      const ratio = Math.min(a.duration, b.duration) / Math.max(a.duration, b.duration)
      s += ratio * 0.10
    }

    return { score: Math.min(1, s), reason: reasons.join(', ') || 'General similarity' }
  }
}

let _instance: SampleRecommender | null = null

export function getSampleRecommender(): SampleRecommender {
  if (!_instance) _instance = new SampleRecommender()
  return _instance
}

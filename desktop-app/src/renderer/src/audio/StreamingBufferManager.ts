import type { WaveformLoader } from './WaveformLoader'

// Prefetches AudioBuffers for tracks that will play in the next N bars.
// Prevents decode-on-demand latency spikes during playback.
export class StreamingBufferManager {
  private _loader: WaveformLoader
  private _prefetchQueue: string[] = []
  private _prefetching = false
  private _prefetchAheadBars = 8

  constructor(loader: WaveformLoader) {
    this._loader = loader
  }

  // Call from Clock beat callback when position changes
  onPositionChange(currentBar: number, scheduledUrls: { url: string; bar: number }[]): void {
    const upcoming = scheduledUrls
      .filter(s => s.bar >= currentBar && s.bar <= currentBar + this._prefetchAheadBars)
      .map(s => s.url)
      .filter(url => !this._loader.isCached(url))

    for (const url of upcoming) {
      if (!this._prefetchQueue.includes(url)) this._prefetchQueue.push(url)
    }
    this._drainQueue()
  }

  private async _drainQueue(): Promise<void> {
    if (this._prefetching || this._prefetchQueue.length === 0) return
    this._prefetching = true
    while (this._prefetchQueue.length > 0) {
      const url = this._prefetchQueue.shift()!
      await this._loader.load(url).catch(() => { /* ignore prefetch errors */ })
    }
    this._prefetching = false
  }
}

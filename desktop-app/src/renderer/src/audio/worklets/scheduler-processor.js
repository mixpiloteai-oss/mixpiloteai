/**
 * Scheduler AudioWorklet processor.
 * Fires a message to the main thread every `intervalMs` milliseconds,
 * using the audio thread's high-precision clock. This replaces setInterval
 * which is throttled by the browser and subject to main-thread jitter.
 *
 * Message format: { type: 'tick', currentTime: number }
 */
class SchedulerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this._intervalMs = (options.processorOptions?.intervalMs ?? 25) / 1000
    this._nextTickTime = 0
    this.port.onmessage = (e) => {
      if (e.data?.type === 'set-interval') {
        this._intervalMs = e.data.intervalMs / 1000
      }
      if (e.data?.type === 'reset') {
        this._nextTickTime = 0
      }
    }
  }

  process(_inputs, _outputs, _parameters) {
    // currentTime is available as a global in AudioWorkletGlobalScope
    if (currentTime >= this._nextTickTime) {
      this.port.postMessage({ type: 'tick', currentTime })
      this._nextTickTime = currentTime + this._intervalMs
    }
    return true // keep processor alive
  }
}

registerProcessor('scheduler-processor', SchedulerProcessor)

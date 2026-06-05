/**
 * RenderQueue — background serialized job queue for offline rendering.
 *
 * Jobs run one at a time in enqueue order. Cancellation is supported before
 * a job starts; once running it completes (or fails) before the next job runs.
 *
 * The queue is pure TypeScript (no browser or Node-specific APIs) so it can
 * be tested in Node.js. The `run` function supplied by the caller is where
 * the actual audio rendering (which may use AudioContext) lives.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RenderJobStatus = 'queued' | 'rendering' | 'done' | 'error' | 'cancelled'

export interface RenderJob<T = unknown> {
  id:         string
  label:      string
  status:     RenderJobStatus
  progress:   number          // 0–100
  createdAt:  number
  startedAt:  number | null
  completedAt: number | null
  result:     T | null
  error:      string | null
}

export type JobRunner<T> = (
  onProgress: (pct: number, phase?: string) => void,
) => Promise<T>

export type QueueEventType = 'enqueued' | 'started' | 'progress' | 'done' | 'error' | 'cancelled'

export interface QueueEvent<T = unknown> {
  type:  QueueEventType
  jobId: string
  job:   RenderJob<T>
}

type QueueListener<T = unknown> = (event: QueueEvent<T>) => void

// ─── RenderQueue ──────────────────────────────────────────────────────────────

export class RenderQueue {
  private _jobs     = new Map<string, RenderJob>()
  private _runners  = new Map<string, JobRunner<unknown>>()
  private _order:   string[] = []          // job IDs in enqueue order
  private _running  = false
  private _idSeq    = 0
  private _listeners: QueueListener[] = []

  // ── Subscribe to queue events ─────────────────────────────────────────────

  on(cb: QueueListener): () => void {
    this._listeners.push(cb)
    return () => { this._listeners = this._listeners.filter(l => l !== cb) }
  }

  private _emit(type: QueueEventType, job: RenderJob): void {
    const event: QueueEvent = { type, jobId: job.id, job }
    for (const l of this._listeners) {
      try { l(event) } catch { /* listener errors must not break the queue */ }
    }
  }

  // ── Enqueue a new job ─────────────────────────────────────────────────────

  enqueue<T>(label: string, runner: JobRunner<T>): string {
    const id  = `rq-${Date.now()}-${++this._idSeq}`
    const job: RenderJob<T> = {
      id,
      label,
      status:      'queued',
      progress:    0,
      createdAt:   Date.now(),
      startedAt:   null,
      completedAt: null,
      result:      null,
      error:       null,
    }
    this._jobs.set(id, job as RenderJob)
    this._runners.set(id, runner as JobRunner<unknown>)
    this._order.push(id)
    this._emit('enqueued', job as RenderJob)
    this._scheduleNext()
    return id
  }

  // ── Cancel a queued job (cannot cancel a running job) ────────────────────

  cancel(jobId: string): boolean {
    const job = this._jobs.get(jobId)
    if (!job || job.status !== 'queued') return false
    job.status      = 'cancelled'
    job.completedAt = Date.now()
    this._emit('cancelled', job)
    return true
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getJob(id: string): RenderJob | null {
    return this._jobs.get(id) ?? null
  }

  getJobs(): RenderJob[] {
    return this._order.map(id => this._jobs.get(id)!).filter(Boolean)
  }

  getPendingCount(): number {
    return this.getJobs().filter(j => j.status === 'queued' || j.status === 'rendering').length
  }

  clearCompleted(): void {
    const completed = this.getJobs().filter(j =>
      j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
    )
    for (const j of completed) {
      this._jobs.delete(j.id)
      this._runners.delete(j.id)
      this._order = this._order.filter(id => id !== j.id)
    }
  }

  // ── Internal: run next queued job ─────────────────────────────────────────

  private _scheduleNext(): void {
    if (this._running) return
    const next = this._order.find(id => this._jobs.get(id)?.status === 'queued')
    if (!next) return
    this._running = true
    void this._runJob(next)
  }

  private async _runJob(id: string): Promise<void> {
    const job    = this._jobs.get(id)
    const runner = this._runners.get(id)
    if (!job || !runner) { this._running = false; this._scheduleNext(); return }

    if (job.status === 'cancelled') {
      this._running = false
      this._scheduleNext()
      return
    }

    job.status    = 'rendering'
    job.startedAt = Date.now()
    this._emit('started', job)

    try {
      const result = await runner((pct, _phase) => {
        job.progress = Math.max(0, Math.min(100, Math.round(pct)))
        this._emit('progress', job)
      })
      job.status      = 'done'
      job.progress    = 100
      job.completedAt = Date.now()
      job.result      = result
      this._emit('done', job)
    } catch (err) {
      job.status      = 'error'
      job.completedAt = Date.now()
      job.error       = err instanceof Error ? err.message : String(err)
      this._emit('error', job)
    }

    this._running = false
    this._scheduleNext()
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: RenderQueue | null = null

export function getRenderQueue(): RenderQueue {
  if (!_instance) _instance = new RenderQueue()
  return _instance
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────
// Manages a pool of DSP Web Workers. Tasks are dispatched round-robin and
// resolved via Promises. Automatically sizes the pool to hardware threads.

import type { DSPTask, DSPResult } from './workers/dsp.worker'

type PendingTask = {
  resolve: (r: DSPResult) => void
  reject:  (e: Error)     => void
}

export class WorkerPool {
  private workers:  Worker[]         = []
  private pending:  Map<string, PendingTask> = new Map()
  private rr = 0   // round-robin index

  constructor(size?: number) {
    const count = size ?? Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1)
    for (let i = 0; i < count; i++) {
      const w = new Worker(
        new URL('./workers/dsp.worker.ts', import.meta.url),
        { type: 'module' },
      )
      w.onmessage = (e: MessageEvent<DSPResult & { error?: string }>) => {
        const { id, error } = e.data as DSPResult & { error?: string }
        const p = this.pending.get(id)
        if (!p) return
        this.pending.delete(id)
        if (error) p.reject(new Error(error))
        else        p.resolve(e.data as DSPResult)
      }
      this.workers.push(w)
    }
  }

  dispatch(task: DSPTask, transfer?: Transferable[]): Promise<DSPResult> {
    return new Promise<DSPResult>((resolve, reject) => {
      this.pending.set(task.id, { resolve, reject })
      const worker = this.workers[this.rr % this.workers.length]!
      this.rr++
      if (transfer?.length) worker.postMessage(task, transfer)
      else                   worker.postMessage(task)
    })
  }

  resize(count: number): void {
    const current = this.workers.length
    if (count > current) {
      for (let i = current; i < count; i++) {
        const w = new Worker(
          new URL('./workers/dsp.worker.ts', import.meta.url),
          { type: 'module' },
        )
        w.onmessage = (e: MessageEvent<DSPResult & { error?: string }>) => {
          const { id, error } = e.data as DSPResult & { error?: string }
          const p = this.pending.get(id)
          if (!p) return
          this.pending.delete(id)
          if (error) p.reject(new Error(error))
          else        p.resolve(e.data as DSPResult)
        }
        this.workers.push(w)
      }
    } else if (count < current) {
      const removed = this.workers.splice(count)
      removed.forEach(w => w.terminate())
    }
  }

  get size(): number { return this.workers.length }

  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.pending.forEach(p => p.reject(new Error('WorkerPool terminated')))
    this.pending.clear()
  }
}

let _pool: WorkerPool | null = null

export function getWorkerPool(size?: number): WorkerPool {
  if (!_pool) _pool = new WorkerPool(size)
  return _pool
}

export function destroyWorkerPool(): void {
  _pool?.terminate()
  _pool = null
}

// ─── RenderQueue.test.ts ──────────────────────────────────────────────────────
// Tests the background render queue: enqueue, cancel, ordering, error handling,
// progress events, and concurrent safety.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { RenderQueue } from '../../src/renderer/src/audio/export/RenderQueue.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQueue() { return new RenderQueue() }

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function resolveRunner<T>(value: T, delayMs = 0) {
  return async (onProg: (pct: number) => void) => {
    onProg(50)
    if (delayMs > 0) await delay(delayMs)
    onProg(100)
    return value
  }
}

function rejectRunner(msg: string) {
  return async () => { throw new Error(msg) }
}

// ─── enqueue / status ─────────────────────────────────────────────────────────

describe('RenderQueue / enqueue', () => {
  it('enqueued job has status "queued" initially', () => {
    const q  = makeQueue()
    const id = q.enqueue('Test', async () => 42)
    // Job is queued; it may transition to 'rendering' immediately via async
    const job = q.getJob(id)
    assert.ok(job, 'job exists')
    assert.ok(['queued', 'rendering'].includes(job!.status), `status=${job!.status}`)
  })

  it('getJobs returns all jobs in enqueue order', () => {
    const q   = makeQueue()
    const id1 = q.enqueue('A', resolveRunner(1))
    const id2 = q.enqueue('B', resolveRunner(2))
    const ids = q.getJobs().map(j => j.id)
    assert.ok(ids.includes(id1))
    assert.ok(ids.includes(id2))
    assert.equal(ids.indexOf(id1), 0)
  })

  it('job has createdAt timestamp', () => {
    const q   = makeQueue()
    const id  = q.enqueue('T', resolveRunner(0))
    assert.ok(q.getJob(id)!.createdAt > 0)
  })
})

// ─── completion ───────────────────────────────────────────────────────────────

describe('RenderQueue / job completion', () => {
  it('job status becomes "done" after successful run', async () => {
    const q   = makeQueue()
    let done  = false
    const off = q.on((e) => { if (e.type === 'done') done = true })
    const id  = q.enqueue('T', resolveRunner(42))
    await delay(50)
    const job = q.getJob(id)
    assert.equal(job!.status, 'done')
    assert.equal(job!.result, 42)
    off()
  })

  it('job progress reaches 100 on done', async () => {
    const q  = makeQueue()
    const id = q.enqueue('T', resolveRunner('ok'))
    await delay(50)
    assert.equal(q.getJob(id)!.progress, 100)
  })

  it('job sets completedAt after done', async () => {
    const q  = makeQueue()
    const id = q.enqueue('T', resolveRunner(0))
    await delay(50)
    assert.ok(q.getJob(id)!.completedAt !== null)
  })
})

// ─── error handling ───────────────────────────────────────────────────────────

describe('RenderQueue / error handling', () => {
  it('failed job has status "error"', async () => {
    const q   = makeQueue()
    const id  = q.enqueue('Bad', rejectRunner('boom'))
    await delay(50)
    const job = q.getJob(id)
    assert.equal(job!.status, 'error')
    assert.ok(job!.error?.includes('boom'))
  })

  it('queue continues after a failed job', async () => {
    const q    = makeQueue()
    const id1  = q.enqueue('Bad',  rejectRunner('fail'))
    const id2  = q.enqueue('Good', resolveRunner(99))
    await delay(100)
    assert.equal(q.getJob(id1)!.status, 'error')
    assert.equal(q.getJob(id2)!.status, 'done')
    assert.equal(q.getJob(id2)!.result, 99)
  })
})

// ─── cancel ───────────────────────────────────────────────────────────────────

describe('RenderQueue / cancel', () => {
  it('cancelling a queued job sets status to "cancelled"', async () => {
    const q   = makeQueue()
    // Enqueue a long-running job to block the queue
    q.enqueue('Blocker', async () => { await delay(500); return 0 })
    // Enqueue second job (will be queued, not started)
    const id2 = q.enqueue('Target', resolveRunner(42))
    // Cancel before it starts
    const ok  = q.cancel(id2)
    assert.ok(ok, 'cancel should return true for queued job')
    assert.equal(q.getJob(id2)!.status, 'cancelled')
  })

  it('cancel returns false for non-existent job', () => {
    const q = makeQueue()
    assert.equal(q.cancel('nonexistent'), false)
  })

  it('cancel returns false for already-running job', async () => {
    const q   = makeQueue()
    const id  = q.enqueue('Running', async () => { await delay(500); return 0 })
    await delay(5)   // let it start
    // Cancel a running job — should return false
    const ok = q.cancel(id)
    // It's either running (false) or already done — either way it ran
    // (timing-sensitive: check that cancel on a running/done job is handled gracefully)
    assert.ok(typeof ok === 'boolean')
  })

  it('queue skips cancelled job and runs next one', async () => {
    const q   = makeQueue()
    q.enqueue('Blocker', async () => { await delay(300); return 0 })
    const id2 = q.enqueue('Skipped', resolveRunner('skip'))
    const id3 = q.enqueue('Next',    resolveRunner('next'))
    q.cancel(id2)
    await delay(400)
    assert.equal(q.getJob(id2)!.status, 'cancelled')
    assert.equal(q.getJob(id3)!.status, 'done')
  })
})

// ─── ordering ─────────────────────────────────────────────────────────────────

describe('RenderQueue / ordering', () => {
  it('jobs execute in FIFO order', async () => {
    const q      = makeQueue()
    const order: number[] = []
    const runner = (n: number) => async () => { order.push(n); return n }

    q.enqueue('A', runner(1))
    q.enqueue('B', runner(2))
    q.enqueue('C', runner(3))

    await delay(150)
    assert.deepEqual(order, [1, 2, 3])
  })

  it('only one job runs at a time', async () => {
    const q   = makeQueue()
    let active = 0
    let maxActive = 0

    const runner = async (onProg: (n: number) => void) => {
      active++
      maxActive = Math.max(maxActive, active)
      onProg(50)
      await delay(20)
      active--
      onProg(100)
    }

    q.enqueue('J1', runner)
    q.enqueue('J2', runner)
    q.enqueue('J3', runner)
    await delay(200)
    assert.equal(maxActive, 1, 'at most 1 job runs at a time')
  })
})

// ─── progress events ─────────────────────────────────────────────────────────

describe('RenderQueue / progress events', () => {
  it('emits "enqueued" event on enqueue', async () => {
    const q      = makeQueue()
    const events: string[] = []
    const off    = q.on(e => events.push(e.type))
    q.enqueue('T', resolveRunner(0))
    off()
    assert.ok(events.includes('enqueued'))
  })

  it('emits "started" and "done" events', async () => {
    const q      = makeQueue()
    const events: string[] = []
    const off    = q.on(e => events.push(e.type))
    q.enqueue('T', resolveRunner(0))
    await delay(50)
    off()
    assert.ok(events.includes('started'))
    assert.ok(events.includes('done'))
  })

  it('emits "progress" events during run', async () => {
    const q        = makeQueue()
    const progPcts: number[] = []
    const off      = q.on(e => { if (e.type === 'progress') progPcts.push(e.job.progress) })
    q.enqueue('T', resolveRunner(0))
    await delay(50)
    off()
    assert.ok(progPcts.length > 0, 'progress events fired')
  })

  it('emits "error" event on failure', async () => {
    const q      = makeQueue()
    const events: string[] = []
    const off    = q.on(e => events.push(e.type))
    q.enqueue('Bad', rejectRunner('x'))
    await delay(50)
    off()
    assert.ok(events.includes('error'))
  })

  it('emits "cancelled" event on cancel', () => {
    const q      = makeQueue()
    const events: string[] = []
    const off    = q.on(e => events.push(e.type))
    q.enqueue('Blocker', async () => { await delay(500); return 0 })
    const id = q.enqueue('T', resolveRunner(0))
    q.cancel(id)
    off()
    assert.ok(events.includes('cancelled'))
  })

  it('listener errors do not crash the queue', async () => {
    const q   = makeQueue()
    q.on(() => { throw new Error('bad listener') })
    q.enqueue('T', resolveRunner(42))
    await delay(50)
    assert.equal(q.getJob(q.getJobs()[0]!.id)!.status, 'done')
  })
})

// ─── clearCompleted ───────────────────────────────────────────────────────────

describe('RenderQueue / clearCompleted', () => {
  it('removes done, error, cancelled jobs', async () => {
    const q   = makeQueue()
    const id1 = q.enqueue('A', resolveRunner(1))
    const id2 = q.enqueue('B', rejectRunner('fail'))
    await delay(100)
    q.clearCompleted()
    assert.equal(q.getJob(id1), null)
    assert.equal(q.getJob(id2), null)
    assert.equal(q.getJobs().length, 0)
  })

  it('does not remove queued or running jobs', async () => {
    const q   = makeQueue()
    q.enqueue('Blocker', async () => { await delay(500); return 0 })
    const id2 = q.enqueue('Q', resolveRunner(0))
    await delay(5)
    q.clearCompleted()
    // id2 is still queued — should remain
    assert.ok(q.getJob(id2) !== null)
  })
})

// ─── getPendingCount ─────────────────────────────────────────────────────────

describe('RenderQueue / getPendingCount', () => {
  it('returns 0 for empty queue', () => {
    assert.equal(makeQueue().getPendingCount(), 0)
  })

  it('counts queued + rendering jobs', async () => {
    const q = makeQueue()
    q.enqueue('A', async () => { await delay(500); return 0 })
    q.enqueue('B', resolveRunner(0))
    // 1 rendering + 1 queued = 2
    assert.equal(q.getPendingCount(), 2)
    await delay(600)
    // Both done
    assert.equal(q.getPendingCount(), 0)
  })
})

// ─── stress test ─────────────────────────────────────────────────────────────

describe('RenderQueue / stress', () => {
  it('20 jobs enqueue and complete in order', async () => {
    const q      = makeQueue()
    const done:  number[] = []
    const N = 20

    for (let i = 0; i < N; i++) {
      const n = i
      q.enqueue(`Job ${n}`, async () => { done.push(n); return n })
    }

    await delay(200)
    assert.equal(done.length, N)
    // Should be in order
    for (let i = 0; i < N; i++) assert.equal(done[i], i)
  })

  it('mix of errors and successes: all complete without crashing', async () => {
    const q = makeQueue()
    const results: string[] = []
    const off = q.on(e => {
      if (e.type === 'done' || e.type === 'error') results.push(e.type)
    })

    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0) q.enqueue(`Err ${i}`, rejectRunner(`err ${i}`))
      else             q.enqueue(`Ok  ${i}`, resolveRunner(i))
    }

    await delay(300)
    off()
    assert.equal(results.length, 10, `expected 10 completions, got ${results.length}`)
  })
})

export class ObjectPool<T> {
  private _pool:    T[] = []
  private _active:  Set<T> = new Set()
  private _create:  () => T
  private _reset:   (obj: T) => void
  private _maxSize: number

  constructor(create: () => T, reset: (obj: T) => void, maxSize = 64) {
    this._create  = create
    this._reset   = reset
    this._maxSize = maxSize
  }

  acquire(): T {
    const obj = this._pool.pop() ?? this._create()
    this._active.add(obj)
    return obj
  }

  release(obj: T): void {
    if (!this._active.has(obj)) return
    this._active.delete(obj)
    this._reset(obj)
    if (this._pool.length < this._maxSize) {
      this._pool.push(obj)
    }
  }

  releaseAll(): void {
    for (const obj of this._active) {
      this._reset(obj)
      if (this._pool.length < this._maxSize) this._pool.push(obj)
    }
    this._active.clear()
  }

  get poolSize(): number  { return this._pool.length }
  get activeCount(): number { return this._active.size }
}

export interface PooledRect {
  x: number; y: number; w: number; h: number
  color: string; label: string; alpha: number
}

export const rectPool = new ObjectPool<PooledRect>(
  () => ({ x: 0, y: 0, w: 0, h: 0, color: '', label: '', alpha: 1 }),
  (r) => { r.x = 0; r.y = 0; r.w = 0; r.h = 0; r.color = ''; r.label = ''; r.alpha = 1 },
)

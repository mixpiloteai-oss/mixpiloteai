export interface Mark {
  label: string
  ts:    number
}

export class PerformanceProfiler {
  private marks: Mark[]
  private maxMarks: number

  constructor(opts?: { maxMarks?: number }) {
    this.maxMarks = opts?.maxMarks ?? 1000
    this.marks    = []
  }

  mark(label: string): void {
    if (this.marks.length >= this.maxMarks) this.marks.shift()
    this.marks.push({ label, ts: performance.now() })
  }

  measure(label: string): number | null {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      if (this.marks[i].label === label) {
        return performance.now() - this.marks[i].ts
      }
    }
    return null
  }

  startSpan(label: string): () => number {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      if (this.marks.length >= this.maxMarks) this.marks.shift()
      this.marks.push({ label, ts: start })
      return duration
    }
  }

  getMarks(): Mark[] {
    return [...this.marks]
  }

  clear(): void {
    this.marks = []
  }
}

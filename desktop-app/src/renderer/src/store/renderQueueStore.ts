import { create } from 'zustand'
import { getRenderQueue, type RenderJob } from '../audio/export/RenderQueue'

interface RenderQueueState {
  jobs:   RenderJob[]

  // Actions
  refresh():    void
  cancel(id: string): void
  clearCompleted(): void
  enqueueExport(label: string, run: () => Promise<unknown>): string
}

export const useRenderQueueStore = create<RenderQueueState>((set) => {
  // Subscribe to the singleton queue and sync state on every event
  getRenderQueue().on(() => {
    set({ jobs: getRenderQueue().getJobs() })
  })

  return {
    jobs: [],

    refresh() {
      set({ jobs: getRenderQueue().getJobs() })
    },

    cancel(id) {
      getRenderQueue().cancel(id)
    },

    clearCompleted() {
      getRenderQueue().clearCompleted()
      set({ jobs: getRenderQueue().getJobs() })
    },

    enqueueExport(label, run) {
      const id = getRenderQueue().enqueue(label, run)
      set({ jobs: getRenderQueue().getJobs() })
      return id
    },
  }
})

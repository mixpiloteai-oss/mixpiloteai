import { create } from 'zustand'
import type { LocalAIResult } from '../services/ai/LocalAIEngine'

interface LocalAIStore {
  result:     LocalAIResult | null
  analyzing:  boolean
  setResult:  (r: LocalAIResult) => void
  setAnalyzing: (v: boolean) => void
}

export const useLocalAIStore = create<LocalAIStore>((set) => ({
  result:     null,
  analyzing:  false,
  setResult:  (r) => set({ result: r, analyzing: false }),
  setAnalyzing: (v) => set({ analyzing: v }),
}))

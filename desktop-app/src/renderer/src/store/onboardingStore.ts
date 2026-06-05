import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type OnboardingStep = 'welcome' | 'workflow' | 'template' | 'tour' | 'done'
type WorkflowType = 'producer' | 'beatmaker' | 'live' | null

interface OnboardingState {
  hasSeenWelcome: boolean
  isActive: boolean               // wizard currently open
  currentStep: OnboardingStep
  selectedWorkflow: WorkflowType
  selectedTemplate: string | null
  completedTourSteps: string[]
  dismissedTips: string[]
  onboardingComplete: boolean
  // actions
  startOnboarding: () => void
  skipOnboarding: () => void
  completeOnboarding: () => void
  setStep: (step: OnboardingStep) => void
  setWorkflow: (w: WorkflowType) => void
  setTemplate: (t: string) => void
  completeTourStep: (id: string) => void
  dismissTip: (id: string) => void
  isTipDismissed: (id: string) => boolean
  resetOnboarding: () => void     // for testing/debug
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasSeenWelcome: false,
      isActive: false,
      currentStep: 'welcome',
      selectedWorkflow: null,
      selectedTemplate: null,
      completedTourSteps: [],
      dismissedTips: [],
      onboardingComplete: false,
      startOnboarding: () => set({ isActive: true, currentStep: 'welcome', hasSeenWelcome: true }),
      skipOnboarding: () => set({ isActive: false, onboardingComplete: true }),
      completeOnboarding: () => set({ isActive: false, onboardingComplete: true, currentStep: 'done' }),
      setStep: (step) => set({ currentStep: step }),
      setWorkflow: (w) => set({ selectedWorkflow: w }),
      setTemplate: (t) => set({ selectedTemplate: t }),
      completeTourStep: (id) => set(s => ({ completedTourSteps: [...s.completedTourSteps, id] })),
      dismissTip: (id) => set(s => ({ dismissedTips: [...s.dismissedTips, id] })),
      isTipDismissed: (id) => get().dismissedTips.includes(id),
      resetOnboarding: () => set({
        hasSeenWelcome: false, isActive: false, currentStep: 'welcome',
        selectedWorkflow: null, selectedTemplate: null,
        completedTourSteps: [], dismissedTips: [], onboardingComplete: false
      }),
    }),
    { name: 'nt-onboarding' }
  )
)

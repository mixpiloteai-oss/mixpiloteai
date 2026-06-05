import { useState, useEffect } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useUIStore } from '../../store/uiStore'

// ─── Tour steps ───────────────────────────────────────────────────────────────

interface TourStepDef {
  id: string
  title: string
  desc: string
  box: {
    top: number | string
    left?: number | string
    right?: number | string
    width: number | string
    height: number | string
  }
}

const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'sidebar',
    title: 'Navigation principale',
    desc: 'Accède à toutes les vues: arrangement, piano roll, mixer, et plus.',
    box: { top: 40, left: 0, width: 60, height: 'calc(100vh - 80px)' },
  },
  {
    id: 'transport',
    title: 'Transport & Playback',
    desc: 'Contrôle la lecture, le tempo, et le cycle. Espace pour play/stop.',
    box: { top: 0, left: 60, width: 'calc(100vw - 60px)', height: 44 },
  },
  {
    id: 'arrange',
    title: 'Vue Arrangement',
    desc: 'Construis ta piste ici. Glisse des clips sur la timeline.',
    box: { top: 44, left: 60, width: 'calc(100vw - 300px)', height: 'calc(100vh - 90px)' },
  },
  {
    id: 'ai',
    title: 'Assistant IA',
    desc: 'Ton assistant musical. Pose des questions, génère des idées.',
    box: { top: 44, right: 0, width: 280, height: 'calc(100vh - 90px)' },
  },
]

// ─── Workflow data ────────────────────────────────────────────────────────────

type WorkflowType = 'producer' | 'beatmaker' | 'live' | null

const WORKFLOWS: { id: WorkflowType; icon: string; name: string; desc: string }[] = [
  { id: 'producer',  icon: '🎛️', name: 'Producteur',  desc: 'Beat making, arrangement, mixing' },
  { id: 'beatmaker', icon: '🥁', name: 'Beatmaker',   desc: 'Drums, loops, patterns' },
  { id: 'live',      icon: '🎹', name: 'Live',        desc: 'Performance, clips, scenes' },
]

// ─── Template data ────────────────────────────────────────────────────────────

interface TemplateItem {
  id: string
  icon: string
  name: string
  bpm: number | null
  desc: string
  tags: string[]
}

const TEMPLATES: TemplateItem[] = [
  {
    id: 'mentalcore',
    icon: '🧠',
    name: 'Mentalcore',
    bpm: 170,
    desc: 'Intense, immersif. Fusion psytrance-techno avec textures complexes.',
    tags: ['psytrance', 'techno', 'intense'],
  },
  {
    id: 'hardtek',
    icon: '⚡',
    name: 'Hardtek',
    bpm: 160,
    desc: 'Hard kicks tribaux, energie brutale. Pour les dancefloors underground.',
    tags: ['hard', 'tribal', 'kicks'],
  },
  {
    id: 'ambient',
    icon: '🌌',
    name: 'Ambient',
    bpm: 90,
    desc: 'Pads flottants, atmosphères. Idéal pour créer des textures sonores.',
    tags: ['pads', 'chill', 'atmosphère'],
  },
  {
    id: 'blank',
    icon: '⬜',
    name: 'Blank Project',
    bpm: null,
    desc: 'Démarre de zéro. Configuration vierge, liberté totale.',
    tags: ['vide', 'custom'],
  },
]

// ─── Progress dots ────────────────────────────────────────────────────────────

type OnboardingStep = 'welcome' | 'workflow' | 'template' | 'tour' | 'done'

const STEP_ORDER: OnboardingStep[] = ['welcome', 'workflow', 'template', 'tour']

function ProgressDots({ current }: { current: OnboardingStep }) {
  const currentIdx = STEP_ORDER.indexOf(current)
  return (
    <div className="nt-wizard-dots">
      {STEP_ORDER.map((s, i) => {
        const cls =
          i < currentIdx ? 'nt-wizard-dot done' :
          i === currentIdx ? 'nt-wizard-dot active' :
          'nt-wizard-dot'
        return <div key={s} className={cls} />
      })}
    </div>
  )
}

// ─── Step: Welcome ────────────────────────────────────────────────────────────

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <>
      <div className="nt-wizard-body">
        <ProgressDots current="welcome" />
        <div className="nt-wizard-title">Bienvenue dans Neurotek AI</div>
        <div className="nt-wizard-sub">
          Ton DAW intelligent pour produire de la musique électronique. Découvrons ensemble
          les fonctionnalités essentielles pour démarrer ton premier projet.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { icon: '🎛️', text: 'Arrangement avancé' },
            { icon: '🤖', text: 'Assistant IA intégré' },
            { icon: '🎵', text: 'Templates pro' },
            { icon: '⚡', text: 'Moteur audio haute perf' },
          ].map(f => (
            <div
              key={f.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--nt-bg-surface)',
                border: '1px solid var(--nt-border)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--nt-text)',
              }}
            >
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="nt-wizard-footer">
        <button className="nt-wizard-btn-skip" onClick={onSkip}>Passer</button>
        <button
          onClick={onNext}
          style={{
            background: 'linear-gradient(135deg, var(--nt-purple-600), var(--nt-violet))',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            padding: '10px 24px',
            cursor: 'pointer',
          }}
        >
          Commencer →
        </button>
      </div>
    </>
  )
}

// ─── Step: Workflow ───────────────────────────────────────────────────────────

function StepWorkflow({
  selected,
  onSelect,
  onBack,
  onNext,
  onSkip,
}: {
  selected: WorkflowType
  onSelect: (w: WorkflowType) => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <>
      <div className="nt-wizard-body">
        <ProgressDots current="workflow" />
        <div className="nt-wizard-title">Quel est ton style ?</div>
        <div className="nt-wizard-sub">
          Choisis ton workflow principal pour que Neurotek AI adapte l'interface à tes besoins.
        </div>
        <div className="nt-workflow-grid">
          {WORKFLOWS.map(w => (
            <div
              key={w.id}
              className={`nt-workflow-card${selected === w.id ? ' selected' : ''}`}
              onClick={() => onSelect(w.id)}
            >
              <div className="nt-workflow-icon">{w.icon}</div>
              <div className="nt-workflow-name">{w.name}</div>
              <div className="nt-workflow-desc">{w.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="nt-wizard-footer">
        <button className="nt-wizard-btn-skip" onClick={onSkip}>Passer</button>
        <button className="nt-wizard-btn-skip" onClick={onBack}>← Retour</button>
        <button
          onClick={onNext}
          disabled={!selected}
          style={{
            background: selected
              ? 'linear-gradient(135deg, var(--nt-purple-600), var(--nt-violet))'
              : 'var(--nt-bg-raised)',
            border: 'none',
            borderRadius: 10,
            color: selected ? '#fff' : 'var(--nt-muted)',
            fontSize: 14,
            fontWeight: 700,
            padding: '10px 24px',
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer →
        </button>
      </div>
    </>
  )
}

// ─── Step: Template ───────────────────────────────────────────────────────────

function StepTemplate({
  selected,
  onSelect,
  onBack,
  onNext,
  onSkip,
}: {
  selected: string | null
  onSelect: (t: string) => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <>
      <div className="nt-wizard-body">
        <ProgressDots current="template" />
        <div className="nt-wizard-title">Commence avec un template</div>
        <div className="nt-wizard-sub">
          Choisis un point de départ pour ton projet. Tu pourras tout modifier ensuite.
        </div>
        <div className="nt-template-grid">
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              className={`nt-template-card${selected === t.id ? ' selected' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="nt-template-header">
                <span className="nt-template-icon">{t.icon}</span>
                <span className="nt-template-name">{t.name}</span>
                {t.bpm && (
                  <span className="nt-template-bpm">{t.bpm} BPM</span>
                )}
              </div>
              <div className="nt-template-desc">{t.desc}</div>
              <div className="nt-template-tags">
                {t.tags.map(tag => (
                  <span key={tag} className="nt-template-tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="nt-wizard-footer">
        <button className="nt-wizard-btn-skip" onClick={onSkip}>Passer</button>
        <button className="nt-wizard-btn-skip" onClick={onBack}>← Retour</button>
        <button
          onClick={onNext}
          disabled={!selected}
          style={{
            background: selected
              ? 'linear-gradient(135deg, var(--nt-purple-600), var(--nt-violet))'
              : 'var(--nt-bg-raised)',
            border: 'none',
            borderRadius: 10,
            color: selected ? '#fff' : 'var(--nt-muted)',
            fontSize: 14,
            fontWeight: 700,
            padding: '10px 24px',
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer →
        </button>
      </div>
    </>
  )
}

// ─── Step: Tour ───────────────────────────────────────────────────────────────

function StepTour({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: () => void
}) {
  const [tourIdx, setTourIdx] = useState(0)
  const { completeTourStep } = useOnboardingStore()

  const step = TOUR_STEPS[tourIdx]
  const isLast = tourIdx === TOUR_STEPS.length - 1

  function handleNext() {
    completeTourStep(step.id)
    if (isLast) {
      onComplete()
    } else {
      setTourIdx(i => i + 1)
    }
  }

  function handlePrev() {
    if (tourIdx === 0) {
      onBack()
    } else {
      setTourIdx(i => i - 1)
    }
  }

  // Compute spotlight position
  const box = step.box
  const spotlightStyle: React.CSSProperties = {
    top: box.top,
    width: box.width,
    height: box.height,
  }
  if ('left' in box && box.left !== undefined) {
    spotlightStyle.left = box.left
  }
  if ('right' in box && box.right !== undefined) {
    spotlightStyle.right = box.right
  }

  // Tooltip position: below or above the spotlight
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 8600,
  }
  // Default: place tooltip below center of highlight box, or right side for ai panel
  if (step.id === 'sidebar') {
    tooltipStyle.top = '50%'
    tooltipStyle.left = 80
    tooltipStyle.transform = 'translateY(-50%)'
  } else if (step.id === 'transport') {
    tooltipStyle.top = 54
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translateX(-50%)'
  } else if (step.id === 'arrange') {
    tooltipStyle.top = '50%'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translate(-50%, -50%)'
  } else if (step.id === 'ai') {
    tooltipStyle.top = '50%'
    tooltipStyle.right = 290
    tooltipStyle.transform = 'translateY(-50%)'
  }

  return (
    <>
      {/* Spotlight overlay */}
      <div className="nt-tour-overlay" style={{ pointerEvents: 'none' }}>
        <div className="nt-tour-spotlight" style={spotlightStyle} />
      </div>

      {/* Tooltip */}
      <div className="nt-tour-tooltip" style={tooltipStyle}>
        <div className="nt-tour-tooltip-title">{step.title}</div>
        <div className="nt-tour-tooltip-desc">{step.desc}</div>
        <div className="nt-tour-tooltip-actions">
          <span className="nt-tour-step-count">{tourIdx + 1} / {TOUR_STEPS.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrev}
              style={{
                background: 'var(--nt-bg-raised)',
                border: '1px solid var(--nt-border-hi)',
                borderRadius: 8,
                color: 'var(--nt-text)',
                fontSize: 12,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              ← Retour
            </button>
            <button
              onClick={handleNext}
              style={{
                background: 'linear-gradient(135deg, var(--nt-purple-600), var(--nt-violet))',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Terminer ✓' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Root wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWelcome() {
  const {
    currentStep,
    selectedWorkflow,
    selectedTemplate,
    isActive,
    setStep,
    setWorkflow,
    setTemplate,
    skipOnboarding,
    completeOnboarding,
    startOnboarding,
  } = useOnboardingStore()

  const setView = useUIStore(s => s.setView)

  // Auto-start on mount if not yet active
  useEffect(() => {
    if (!isActive) {
      startOnboarding()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Don't render until active
  if (!isActive) return null

  function handleSkip() {
    skipOnboarding()
  }

  function handleComplete() {
    completeOnboarding()
    setView('arrangement')
  }

  // Tour step renders its own overlay outside the modal
  if (currentStep === 'tour') {
    return (
      <StepTour
        onBack={() => setStep('template')}
        onComplete={handleComplete}
      />
    )
  }

  return (
    <div className="nt-onboarding-backdrop">
      <div className="nt-wizard">
        {/* Header */}
        <div className="nt-wizard-header">
          <div className="nt-wizard-logo">
            <span style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, fontWeight: 800,
              background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)',
              color: '#a855f7',
            }}>
              N
            </span>
            Neurotek AI
          </div>
          <button className="nt-wizard-close" onClick={handleSkip} aria-label="Fermer">✕</button>
        </div>

        {/* Steps */}
        {currentStep === 'welcome' && (
          <StepWelcome
            onNext={() => setStep('workflow')}
            onSkip={handleSkip}
          />
        )}
        {currentStep === 'workflow' && (
          <StepWorkflow
            selected={selectedWorkflow}
            onSelect={setWorkflow}
            onBack={() => setStep('welcome')}
            onNext={() => setStep('template')}
            onSkip={handleSkip}
          />
        )}
        {currentStep === 'template' && (
          <StepTemplate
            selected={selectedTemplate}
            onSelect={setTemplate}
            onBack={() => setStep('workflow')}
            onNext={() => setStep('tour')}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  )
}

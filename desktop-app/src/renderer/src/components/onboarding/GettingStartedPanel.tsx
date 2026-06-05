import { useOnboardingStore } from '../../store/onboardingStore'

const TASKS = [
  { id: 'welcome',     label: 'Bienvenue dans Neurotek AI',  icon: '👋' },
  { id: 'first-track', label: 'Créer ta première piste',     icon: '🎵' },
  { id: 'use-ai',      label: "Utiliser l'assistant IA",     icon: '🤖' },
  { id: 'export',      label: 'Exporter ton premier projet', icon: '📤' },
  { id: 'marketplace', label: 'Explorer le marketplace',     icon: '🛒' },
]

export default function GettingStartedPanel() {
  const {
    onboardingComplete,
    completedTourSteps,
    startOnboarding,
    skipOnboarding,
  } = useOnboardingStore()

  if (onboardingComplete) return null

  const completedCount = completedTourSteps.filter(id =>
    TASKS.some(t => t.id === id)
  ).length
  const pct = Math.round((completedCount / TASKS.length) * 100)

  return (
    <div className="nt-gs-bar">
      <div className="nt-gs-bar-header">
        <span className="nt-gs-bar-label">Prise en main</span>
        <span className="nt-gs-bar-pct">{pct}%</span>
      </div>
      <div className="nt-gs-track">
        <div className="nt-gs-fill" style={{ width: `${pct}%` }} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TASKS.map(task => {
          const done = completedTourSteps.includes(task.id)
          return (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: done ? 'var(--nt-muted)' : 'var(--nt-text)',
                opacity: done ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{done ? '✓' : task.icon}</span>
              <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{task.label}</span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={startOnboarding}
          style={{
            background: 'linear-gradient(135deg, var(--nt-purple-600), var(--nt-violet))',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 14px',
            cursor: 'pointer',
          }}
        >
          Reprendre le tour
        </button>
        <span
          onClick={skipOnboarding}
          style={{ fontSize: 11, color: 'var(--nt-dim)', cursor: 'pointer' }}
        >
          Ignorer
        </span>
      </div>
    </div>
  )
}

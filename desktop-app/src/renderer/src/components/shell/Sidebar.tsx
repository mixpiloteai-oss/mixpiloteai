import { useUIStore, type ViewId } from '../../store/uiStore'
import PremiumBadge from '../shell/PremiumBadge'

const NAV_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'arrangement', label: 'Arrangement', icon: '≡' },
  { id: 'mixer',       label: 'Mixer',       icon: '⊟' },
  { id: 'pianoroll',   label: 'Piano Roll',  icon: '♪' },
  { id: 'live',        label: 'Live Mode',   icon: '▶' },
  { id: 'vst',         label: 'Plugins',     icon: '⊕' },
  { id: 'ai',          label: 'AI Assistant',icon: '✦' },
  { id: 'routing',     label: 'Routing',     icon: '⊗' },
  { id: 'ai-local',    label: 'Local AI',    icon: '⊙' },
  { id: 'performance', label: 'Performance', icon: '⚙' },
  { id: 'export',      label: 'Export',      icon: '⬇' },
  { id: 'collab',      label: 'Collaboration', icon: '⚯' },
  { id: 'marketplace', label: 'Marketplace',   icon: '⊞' },
]

export default function Sidebar() {
  const { activeView, setView } = useUIStore()

  return (
    <aside
      className="flex flex-col items-center py-3 gap-1 shrink-0"
      style={{ width: 52, background: '#08080f', borderRight: '1px solid #1c1c2e' }}
    >
      {/* Logo dot — pulse on hover via .sidebar-logo */}
      <div
        className="sidebar-logo w-7 h-7 rounded-lg bg-gradient-to-br from-studio-purple to-studio-cyan flex items-center justify-center text-[10px] font-bold text-white mb-3 cursor-default"
      >
        N
      </div>

      <div className="flex-1 flex flex-col gap-1">
      {NAV_ITEMS.map(({ id, label, icon }) => {
        const active = activeView === id
        return (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`sidebar-nav-btn relative w-9 h-9 rounded-xl flex items-center justify-center text-base gpu${active ? ' active' : ''}`}
            style={{
              background:  active ? 'rgba(124,58,237,0.2)' : 'transparent',
              color:       active ? '#a855f7' : '#475569',
              border:      active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
            }}
            aria-label={label}
          >
            {icon}
            {/* Smooth tooltip — delay 150ms, cubic easing via .sidebar-tooltip */}
            <span className="sidebar-tooltip">{label}</span>
          </button>
        )
      })}
      </div>

      {/* Premium badge / upgrade prompt */}
      <PremiumBadge />
    </aside>
  )
}

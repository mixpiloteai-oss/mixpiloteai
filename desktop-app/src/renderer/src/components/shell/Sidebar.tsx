import { useUIStore, type ViewId } from '../../store/uiStore'

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
]

export default function Sidebar() {
  const { activeView, setView } = useUIStore()

  return (
    <aside
      className="flex flex-col items-center py-3 gap-1 shrink-0"
      style={{ width: 52, background: '#08080f', borderRight: '1px solid #1c1c2e' }}
    >
      {/* Logo dot */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-studio-purple to-studio-cyan flex items-center justify-center text-[10px] font-bold text-white mb-3">
        N
      </div>

      {NAV_ITEMS.map(({ id, label, icon }) => {
        const active = activeView === id
        return (
          <button
            key={id}
            title={label}
            onClick={() => setView(id)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-150 group"
            style={{
              background: active ? 'rgba(124,58,237,0.2)' : 'transparent',
              color:      active ? '#a855f7' : '#475569',
              border:     active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
            }}
          >
            {icon}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2.5 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
              style={{ background: '#1c1c2e', color: '#e2e8f0', border: '1px solid #2e2e42' }}>
              {label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// ─── LayoutModeSelector ───────────────────────────────────────────────────────
// Compact toolbar for switching between Ableton / FL Studio / Logic layout presets
// and toggling individual panels.

import { useLayoutStore, type LayoutMode } from '../../store/layoutStore'

const MODES: Array<{ id: LayoutMode; label: string; icon: string }> = [
  { id: 'ableton',   label: 'Ableton',   icon: '⊟' },
  { id: 'fl-studio', label: 'FL Studio', icon: '⊕' },
  { id: 'logic',     label: 'Logic',     icon: '◈' },
]

export default function LayoutModeSelector() {
  const { mode, panelSizes, setMode, toggleBrowser, toggleInspector, toggleMixer } = useLayoutStore()

  return (
    <div style={{
      height:          28,
      display:         'flex',
      alignItems:      'center',
      gap:             4,
      padding:         '0 8px',
      background:      '#09090f',
      borderBottom:    '1px solid rgba(255,255,255,0.05)',
      flexShrink:      0,
    }}>
      {/* Layout mode presets */}
      <span style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.08em', marginRight: 4, textTransform: 'uppercase' }}>
        Layout
      </span>

      {MODES.map(m => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={`${m.label} layout preset`}
            style={{
              padding:       '2px 8px',
              borderRadius:  4,
              fontSize:      10,
              fontWeight:    active ? 600 : 400,
              cursor:        'pointer',
              background:    active ? 'rgba(124,58,237,0.22)' : 'transparent',
              color:         active ? '#a855f7' : '#475569',
              border:        `1px solid ${active ? 'rgba(124,58,237,0.40)' : 'transparent'}`,
              transition:    'all 0.12s',
            }}
          >
            {m.icon} {m.label}
          </button>
        )
      })}

      <div style={{ width: 1, height: 14, background: '#1c1c2e', margin: '0 4px' }} />

      {/* Panel toggles */}
      {(
        [
          { key: 'browser',   label: 'Browser',   open: panelSizes.browserOpen,   toggle: toggleBrowser   },
          { key: 'mixer',     label: 'Mixer',     open: panelSizes.mixerOpen,     toggle: toggleMixer     },
          { key: 'inspector', label: 'Inspector', open: panelSizes.inspectorOpen, toggle: toggleInspector },
        ] as const
      ).map(({ key, label, open, toggle }) => (
        <button
          key={key}
          onClick={toggle}
          title={`${open ? 'Hide' : 'Show'} ${label}`}
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     10,
            fontWeight:   open ? 600 : 400,
            cursor:       'pointer',
            background:   open ? 'rgba(16,185,129,0.15)' : 'transparent',
            color:        open ? '#10b981' : '#334155',
            border:       `1px solid ${open ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
            transition:   'all 0.12s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

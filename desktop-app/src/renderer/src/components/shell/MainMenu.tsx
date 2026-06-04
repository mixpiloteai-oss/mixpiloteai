import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useTransportStore } from '../../store/transportStore'
import { useHistoryStore } from '../../store/historyStore'
import { useProjectStore } from '../../store/projectStore'
import { HotkeyManager } from '../../hotkeys/HotkeyManager'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItemDef {
  id: string
  label: string
  shortcut?: string
  separator?: boolean
  disabled?: boolean
  action?: () => void
}

interface MenuDef {
  id: string
  label: string
  items: MenuItemDef[]
}

// ─── Dropdown item ────────────────────────────────────────────────────────────

function DropdownItem({ item, onClose }: { item: MenuItemDef; onClose: () => void }): JSX.Element {
  if (item.separator) {
    return (
      <hr
        key={item.id}
        style={{
          border: 'none',
          borderTop: '1px solid #1a1a2e',
          margin: '4px 0',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => {
        if (item.disabled) return
        item.action?.()
        onClose()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        fontSize: 13,
        color: item.disabled ? '#555' : '#e2e8f0',
        cursor: item.disabled ? 'default' : 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!item.disabled) {
          (e.currentTarget as HTMLDivElement).style.background = '#1a1a2e'
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.shortcut && (
        <span style={{ color: '#666', fontSize: 11, marginLeft: 32 }}>{item.shortcut}</span>
      )}
    </div>
  )
}

// ─── Single top-level menu ────────────────────────────────────────────────────

function TopMenu({ menu }: { menu: MenuDef }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '6px 12px',
          fontSize: 13,
          color: '#e2e8f0',
          cursor: 'pointer',
          borderRadius: 4,
          userSelect: 'none',
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }
        }}
      >
        {menu.label}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: '#0d0d1a',
            border: '1px solid #1a1a2e',
            borderRadius: 4,
            minWidth: 200,
            zIndex: 9999,
            padding: '4px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {menu.items.map((item) => (
            <DropdownItem key={item.id} item={item} onClose={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MainMenu ─────────────────────────────────────────────────────────────────

export function MainMenu(): JSX.Element {
  const menus: MenuDef[] = [
    {
      id: 'neurotek',
      label: 'Neurotek ▾',
      items: [
        {
          id: 'about',
          label: 'À propos de Neurotek Studio',
          action: () => alert('Neurotek Studio — DAW IA\nVersion 0.1.0'),
        },
        {
          id: 'prefs',
          label: 'Préférences',
          disabled: true,
          action: () => { /* preferences not yet implemented */ },
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'quit',
          label: 'Quitter',
          action: () => window.close(),
        },
      ],
    },
    {
      id: 'file',
      label: 'Fichier ▾',
      items: [
        {
          id: 'new',
          label: 'Nouveau projet',
          shortcut: 'Ctrl+N',
          action: () => { useUIStore.getState().openWelcome() },
        },
        {
          id: 'open',
          label: 'Ouvrir projet',
          shortcut: 'Ctrl+O',
          action: () => {
            if (!window.electronAPI) {
              alert('Open via File > Import')
            }
          },
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'save',
          label: 'Enregistrer',
          shortcut: 'Ctrl+S',
          action: () => {
            const project = useProjectStore.getState().project
            localStorage.setItem('neurotek-project', JSON.stringify(project))
          },
        },
        {
          id: 'save-as',
          label: 'Enregistrer sous...',
          action: () => {
            const name = window.prompt('Nom du projet:', useProjectStore.getState().project.name)
            if (name) {
              useProjectStore.getState().setProjectName(name)
              const project = useProjectStore.getState().project
              localStorage.setItem('neurotek-project', JSON.stringify(project))
            }
          },
        },
        { id: 'sep2', label: '', separator: true },
        {
          id: 'import',
          label: 'Importer audio...',
          action: () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.wav,.mp3,.ogg,.flac,.aiff'
            input.onchange = () => {
              void input.files?.[0] // audio import integration point
            }
            input.click()
          },
        },
        { id: 'sep3', label: '', separator: true },
        {
          id: 'export',
          label: 'Exporter audio',
          action: () => useUIStore.getState().setView('export'),
        },
      ],
    },
    {
      id: 'edit',
      label: 'Édition ▾',
      items: [
        {
          id: 'undo',
          label: 'Annuler',
          shortcut: 'Ctrl+Z',
          action: () => useHistoryStore.getState().undo(),
        },
        {
          id: 'redo',
          label: 'Rétablir',
          shortcut: 'Ctrl+Y',
          action: () => useHistoryStore.getState().redo(),
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'cut',
          label: 'Couper',
          shortcut: 'Ctrl+X',
          action: () => HotkeyManager.getInstance().registry.execute('edit.cut'),
        },
        {
          id: 'copy',
          label: 'Copier',
          shortcut: 'Ctrl+C',
          action: () => HotkeyManager.getInstance().registry.execute('edit.copy'),
        },
        {
          id: 'paste',
          label: 'Coller',
          shortcut: 'Ctrl+V',
          action: () => HotkeyManager.getInstance().registry.execute('edit.paste'),
        },
        { id: 'sep2', label: '', separator: true },
        {
          id: 'select-all',
          label: 'Sélectionner tout',
          shortcut: 'Ctrl+A',
          action: () => HotkeyManager.getInstance().registry.execute('edit.select_all'),
        },
        {
          id: 'deselect',
          label: 'Désélectionner',
          shortcut: 'Escape',
          action: () => HotkeyManager.getInstance().registry.execute('edit.deselect_all'),
        },
      ],
    },
    {
      id: 'view',
      label: 'Vue ▾',
      items: [
        {
          id: 'arrangement',
          label: 'Arrangement',
          shortcut: 'Ctrl+1',
          action: () => useUIStore.getState().setView('arrangement'),
        },
        {
          id: 'mixer',
          label: 'Mixer',
          shortcut: 'Ctrl+2',
          action: () => useUIStore.getState().setView('mixer'),
        },
        {
          id: 'piano-roll',
          label: 'Piano Roll',
          shortcut: 'Ctrl+3',
          action: () => useUIStore.getState().setView('pianoroll'),
        },
        {
          id: 'browser',
          label: 'Browser',
          action: () => useUIStore.getState().setView('ai'),
        },
        {
          id: 'ai',
          label: 'AI Assistant',
          action: () => useUIStore.getState().toggleAIPanel(),
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'toggle-mixer',
          label: 'Mixer visible ✓',
          action: () => useUIStore.getState().toggleMixer(),
        },
        {
          id: 'toggle-piano-roll',
          label: 'Piano Roll visible ✓',
          action: () => useUIStore.getState().togglePianoRoll(),
        },
        {
          id: 'toggle-sidebar',
          label: 'Sidebar ✓',
          action: () => useUIStore.getState().toggleSidebar(),
        },
        { id: 'sep2', label: '', separator: true },
        {
          id: 'beginner-mode',
          label: 'Mode Débutant ✓',
          action: () => useUIStore.getState().toggleBeginnerMode(),
        },
        {
          id: 'shortcuts',
          label: 'Raccourcis clavier',
          shortcut: 'F1',
          action: () => useUIStore.getState().toggleShortcutsPanel(),
        },
      ],
    },
    {
      id: 'transport',
      label: 'Transport ▾',
      items: [
        {
          id: 'play',
          label: 'Play/Pause',
          shortcut: 'Space',
          action: () => useTransportStore.getState().play(),
        },
        {
          id: 'stop',
          label: 'Stop',
          shortcut: 'Escape',
          action: () => useTransportStore.getState().stop(),
        },
        {
          id: 'record',
          label: 'Enregistrer',
          shortcut: 'Ctrl+R',
          action: () => useTransportStore.getState().toggleRecord(),
        },
        {
          id: 'loop',
          label: 'Loop',
          shortcut: 'Ctrl+L',
          action: () => useTransportStore.getState().toggleLoop(),
        },
        {
          id: 'metronome',
          label: 'Métronome',
          action: () => useTransportStore.getState().toggleMetronome(),
        },
      ],
    },
    {
      id: 'help',
      label: 'Aide ▾',
      items: [
        {
          id: 'guide',
          label: 'Guide débutant',
          action: () => useUIStore.getState().toggleBeginnerMode(),
        },
        {
          id: 'shortcuts',
          label: 'Raccourcis clavier',
          action: () => useUIStore.getState().toggleShortcutsPanel(),
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'docs',
          label: 'Documentation en ligne',
          action: () => {
            if (typeof window !== 'undefined') {
              window.open('https://neurotek.studio/docs', '_blank')
            }
          },
        },
        {
          id: 'about',
          label: 'À propos',
          action: () => alert('Neurotek Studio\nVersion 0.1.0\n© 2024 Neurotek'),
        },
      ],
    },
  ]

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          4,
        padding:      '0 8px',
        height:       28,
        flexShrink:   0,
        background:   '#07070e',
        borderBottom: '1px solid #141422',
      }}
    >
      {menus.map((menu) => (
        <TopMenu key={menu.id} menu={menu} />
      ))}
    </div>
  )
}

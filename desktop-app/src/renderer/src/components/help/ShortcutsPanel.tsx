import { useState } from 'react'

interface ShortcutsPanelProps {
  onClose: () => void
}

interface ShortcutItem {
  keys: string
  label: string
}

interface ShortcutGroup {
  name: string
  icon: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    name: 'Transport',
    icon: '🚀',
    items: [
      { keys: 'Espace',    label: 'Play / Pause' },
      { keys: 'Escape',    label: 'Stop (retour au début)' },
      { keys: 'Ctrl+R',    label: 'Enregistrer' },
      { keys: 'Ctrl+L',    label: 'Activer / désactiver Loop' },
      { keys: 'Home',      label: 'Retour au début' },
      { keys: 'Ctrl+↑',   label: 'BPM +1' },
      { keys: 'Ctrl+↓',   label: 'BPM -1' },
    ],
  },
  {
    name: 'Édition',
    icon: '✏️',
    items: [
      { keys: 'Ctrl+Z',    label: 'Annuler (Undo)' },
      { keys: 'Ctrl+Y',    label: 'Rétablir (Redo)' },
      { keys: 'Ctrl+X',    label: 'Couper' },
      { keys: 'Ctrl+C',    label: 'Copier' },
      { keys: 'Ctrl+V',    label: 'Coller' },
      { keys: 'Ctrl+D',    label: 'Dupliquer' },
      { keys: 'Delete',    label: 'Supprimer' },
      { keys: 'Ctrl+A',    label: 'Tout sélectionner' },
      { keys: 'S',         label: 'Couper au point de lecture' },
      { keys: 'Ctrl+Q',    label: 'Quantiser' },
    ],
  },
  {
    name: 'Navigation',
    icon: '🔭',
    items: [
      { keys: 'Ctrl+=',    label: 'Zoom avant' },
      { keys: 'Ctrl+-',    label: 'Zoom arrière' },
      { keys: 'Ctrl+0',    label: 'Zoom adapté' },
      { keys: 'Left',      label: 'Défiler à gauche' },
      { keys: 'Right',     label: 'Défiler à droite' },
    ],
  },
  {
    name: 'Vue',
    icon: '👁',
    items: [
      { keys: 'Ctrl+1',    label: 'Vue Arrangement' },
      { keys: 'Ctrl+2',    label: 'Vue Mixer' },
      { keys: 'Ctrl+3',    label: 'Piano Roll' },
      { keys: 'Ctrl+B',    label: 'Browser / Sidebar' },
      { keys: 'Ctrl+M',    label: 'Afficher / Masquer Mixer' },
      { keys: 'Ctrl+P',    label: 'Afficher / Masquer Piano Roll' },
    ],
  },
  {
    name: 'Outils',
    icon: '🔧',
    items: [
      { keys: 'F1',        label: 'Outil Pointeur (Sélection)' },
      { keys: 'F2',        label: 'Outil Crayon (Dessin)' },
      { keys: 'F3',        label: 'Outil Gomme' },
      { keys: 'F4',        label: 'Outil Coupure' },
      { keys: 'F5',        label: 'Outil Zoom' },
      { keys: 'Tab',       label: 'Outil suivant' },
    ],
  },
  {
    name: 'Mix',
    icon: '🎚',
    items: [
      { keys: 'M',         label: 'Mute piste sélectionnée' },
      { keys: 'Alt+S',     label: 'Solo piste sélectionnée' },
      { keys: 'Alt+R',     label: 'Armer piste pour enregistrement' },
    ],
  },
]

const badgeStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4e',
  borderRadius: 4,
  padding: '2px 8px',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#10b981',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

export default function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  const [search, setSearch] = useState('')

  const filtered: ShortcutGroup[] = SHORTCUT_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(
        item =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.keys.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(group => group.items.length > 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          height: '100%',
          background: '#0d0d1a',
          borderLeft: '1px solid #1a1a2e',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
            ⌨ Raccourcis clavier
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 4,
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Filtrer les raccourcis…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#111128',
              border: '1px solid #2a2a4e',
              borderRadius: 6,
              color: '#e2e8f0',
              fontSize: 13,
              padding: '8px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Groups */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
              Aucun raccourci trouvé
            </div>
          ) : (
            filtered.map(group => (
              <div key={group.name} style={{ marginBottom: 20 }}>
                {/* Group header */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#7c3aed',
                    padding: '6px 0 8px',
                    borderBottom: '1px solid #1a1a2e',
                    marginBottom: 8,
                  }}
                >
                  {group.icon} {group.name}
                </div>

                {/* Items */}
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '5px 0',
                      borderBottom: '1px solid #0f0f20',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#cbd5e1', flex: 1 }}>
                      {item.label}
                    </span>
                    <span style={badgeStyle}>{item.keys}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

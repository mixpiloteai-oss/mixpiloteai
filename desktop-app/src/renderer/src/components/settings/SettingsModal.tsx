// ── SettingsModal.tsx ─────────────────────────────────────────────────────────
// Tabbed settings dialog: Audio · Shortcuts · About.
// Open/close via useUIStore.settingsOpen / toggleSettings.

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import AudioSettingsPanel from './AudioSettingsPanel'

type TabId = 'audio' | 'shortcuts' | 'about'

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space',           action: 'Play / Pause' },
  { keys: 'Enter',           action: 'Stop & return to start' },
  { keys: 'Ctrl+Z',          action: 'Undo' },
  { keys: 'Ctrl+Shift+Z',    action: 'Redo' },
  { keys: 'Ctrl+S',          action: 'Save project' },
  { keys: 'Ctrl+O',          action: 'Open project' },
  { keys: 'Ctrl+N',          action: 'New project' },
  { keys: 'Ctrl+D',          action: 'Duplicate clip' },
  { keys: 'Delete / Backspace', action: 'Delete selected' },
  { keys: 'Ctrl+A',          action: 'Select all' },
  { keys: 'Ctrl+C',          action: 'Copy' },
  { keys: 'Ctrl+X',          action: 'Cut' },
  { keys: 'Ctrl+V',          action: 'Paste' },
  { keys: 'Ctrl+,',          action: 'Open Settings' },
  { keys: 'F1',              action: 'Keyboard shortcuts' },
  { keys: 'F12',             action: 'Performance overlay' },
  { keys: 'Ctrl+Shift+P',    action: 'Audio perf HUD' },
  { keys: '+  /  -',         action: 'Zoom in / out (arrangement)' },
  { keys: 'Tab',             action: 'Cycle active tool' },
  { keys: 'V',               action: 'Pointer tool' },
  { keys: 'P',               action: 'Pencil tool' },
  { keys: 'E',               action: 'Eraser tool' },
  { keys: 'S',               action: 'Slice tool' },
]

function TabButton({ id, label, active, onClick }: {
  id: TabId; label: string; active: boolean; onClick: (id: TabId) => void
}) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        padding: '7px 16px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#e2e8f0' : '#64748b',
        background: active ? '#1c1c2e' : 'none',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  )
}

function ShortcutsTab() {
  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 440 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {SHORTCUTS.map(s => (
            <tr key={s.keys} style={{ borderBottom: '1px solid #1c1c2e' }}>
              <td style={{ padding: '7px 0', width: 180 }}>
                <code style={{
                  fontSize: 11, background: '#0f0f1a', border: '1px solid #1c1c2e',
                  borderRadius: 5, padding: '2px 7px', color: '#a855f7', fontFamily: 'monospace',
                }}>
                  {s.keys}
                </code>
              </td>
              <td style={{ padding: '7px 8px', fontSize: 12, color: '#94a3b8' }}>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AboutTab() {
  return (
    <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#a855f7',
        boxShadow: '0 0 30px rgba(124,58,237,0.15)',
      }}>N</div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Neurotek Studio</h2>
        <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Alpha 0.5.0 — do not distribute</p>
      </div>
      <div style={{ width: '100%', maxWidth: 300, background: '#0a0a0f', border: '1px solid #1c1c2e', borderRadius: 10, padding: '14px 18px' }}>
        {[
          ['Engine', 'Electron 31 + React 18'],
          ['Audio',  'Web Audio API + AudioWorklet'],
          ['State',  'Zustand 4.5 (37 stores)'],
          ['Plugins','VST3 via N-API native addon'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1c1c2e' }}>
            <span style={{ fontSize: 11, color: '#475569' }}>{k}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: '#334155', textAlign: 'center', maxWidth: 280 }}>
        Alpha build — features may be incomplete or unstable.<br />
        Not intended for production use.
      </p>
    </div>
  )
}

export default function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore(s => ({
    settingsOpen: s.settingsOpen,
    closeSettings: s.closeSettings,
  }))
  const [tab, setTab] = useState<TabId>('audio')

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeSettings()
  }, [closeSettings])

  useEffect(() => {
    if (!settingsOpen) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [settingsOpen, handleKey])

  if (!settingsOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeSettings}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: 'fixed', zIndex: 10001,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500, maxWidth: '94vw',
          background: '#0c0c14',
          border: '1px solid #1c1c2e',
          borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px 10px',
          borderBottom: '1px solid #1c1c2e',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <TabButton id="audio"     label="Audio"     active={tab === 'audio'}     onClick={setTab} />
            <TabButton id="shortcuts" label="Shortcuts" active={tab === 'shortcuts'} onClick={setTab} />
            <TabButton id="about"     label="About"     active={tab === 'about'}     onClick={setTab} />
          </div>
          <button
            onClick={closeSettings}
            aria-label="Close settings"
            style={{
              background: 'none', border: 'none', color: '#475569',
              fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab content */}
        {tab === 'audio'     && <AudioSettingsPanel />}
        {tab === 'shortcuts' && <ShortcutsTab />}
        {tab === 'about'     && <AboutTab />}
      </div>
    </>
  )
}

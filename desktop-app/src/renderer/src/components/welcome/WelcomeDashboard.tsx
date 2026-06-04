// ─── WelcomeDashboard ─────────────────────────────────────────────────────────
// Full-screen welcome overlay shown once on first launch (or via Help menu).
// Provides: New Project, Open Project, 3 templates, recent projects.

import { useState, useEffect, useCallback } from 'react'
import { useOnboardingStore }  from '../../store/onboardingStore'
import { useUIStore }          from '../../store/uiStore'
import { useProjectStore }     from '../../store/projectStore'
import {
  buildDefaultProject,
  buildTrapBeatProject,
  buildLoFiProject,
  buildPodcastProject,
} from '../../lib/defaultProject'
import type { Project } from '../../types/project'

// ─── Recent project entry ─────────────────────────────────────────────────────

interface RecentEntry {
  name: string
  bpm:  number
  date: string
}

const STORAGE_KEY = 'daw-recent-projects-v1'

function loadRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as RecentEntry[]
  } catch { return [] }
}

function addRecent(project: Project) {
  const prev    = loadRecents().filter(r => r.name !== project.name).slice(0, 7)
  const updated = [{ name: project.name, bpm: project.bpm, date: new Date().toLocaleDateString() }, ...prev]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  icon:    string
  name:    string
  sub:     string
  bpm:     number
  tracks:  string[]
  color:   string
  onPick:  () => void
}

function TemplateCard({ icon, name, sub, bpm, tracks, color, onPick }: TemplateCardProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:   hover ? `${color}14` : '#0c0c18',
        border:       `1px solid ${hover ? `${color}50` : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 10,
        padding:      16,
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'all 0.15s',
        boxShadow:    hover ? `0 4px 24px ${color}18` : 'none',
        display:      'flex',
        flexDirection:'column',
        gap:          8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${color}20`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{name}</p>
          <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>{sub}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
          {bpm} BPM
        </span>
        {tracks.map(t => (
          <span key={t} style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 5px' }}>
            {t}
          </span>
        ))}
      </div>
    </button>
  )
}

// ─── WelcomeDashboard ─────────────────────────────────────────────────────────

interface WelcomeDashboardProps {
  onClose: () => void
}

export default function WelcomeDashboard({ onClose }: WelcomeDashboardProps) {
  const setView         = useUIStore(s => s.setView)
  const completeOnboard = useOnboardingStore(s => s.skipOnboarding)

  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    setRecents(loadRecents())

    // Pre-load a default project in the background so the workspace is already
    // populated when the user dismisses this overlay (or presses Escape).
    const currentProject = useProjectStore.getState().project
    const hasNoPicks = currentProject.tracks.length === 0
    if (hasNoPicks) {
      const def = buildDefaultProject()
      useProjectStore.setState({ project: def, selectedTrackId: null, selectedClipId: null })
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const applyProject = useCallback((project: Project) => {
    useProjectStore.setState({ project, selectedTrackId: null, selectedClipId: null })
    addRecent(project)
    setView('arrangement')
    if (dontShow) localStorage.setItem('daw-welcomed-v1', '1')
    onClose()
    completeOnboard()
  }, [setView, dontShow, onClose, completeOnboard])

  const openExisting = useCallback(() => {
    // Use file dialog IPC to pick a project file
    window.electronAPI?.openFileDialog?.({ filters: [{ name: 'Neurotek Project', extensions: ['ntai', 'json'] }] })
      .catch(() => {/* silent — user cancelled */})
    if (dontShow) localStorage.setItem('daw-welcomed-v1', '1')
    onClose()
  }, [dontShow, onClose])

  const templates = [
    {
      icon: '🥁', name: 'Default New Project', sub: 'Drums · Bass · Synth · Audio', bpm: 128,
      tracks: ['Drums', 'Bass', 'Synth', 'Audio', 'Master'],
      color: '#7c3aed', build: buildDefaultProject,
    },
    {
      icon: '🎤', name: 'Trap Beat',  sub: 'Hi-energy 808 pattern', bpm: 140,
      tracks: ['Drums', '808', 'Melody', 'Chords', 'FX'],
      color: '#ef4444', build: buildTrapBeatProject,
    },
    {
      icon: '🌙', name: 'Lo-Fi Session', sub: 'Chill, swung grooves', bpm: 85,
      tracks: ['Drums', 'Bass', 'Piano', 'Guitar', 'Vinyl'],
      color: '#06b6d4', build: buildLoFiProject,
    },
    {
      icon: '🎙', name: 'Podcast', sub: 'Multi-voice recording setup', bpm: 120,
      tracks: ['Host', 'Guest', 'Music Bed', 'SFX', 'Master'],
      color: '#10b981', build: buildPodcastProject,
    },
  ]

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9000,
        background:      'rgba(4,4,10,0.92)',
        backdropFilter:  'blur(12px)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         24,
      }}
    >
      <div style={{
        background:    '#0a0a14',
        border:        '1px solid rgba(255,255,255,0.1)',
        borderRadius:  16,
        width:         '100%',
        maxWidth:      760,
        maxHeight:     '90vh',
        overflow:      'auto',
        boxShadow:     '0 0 80px rgba(124,58,237,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding:        '24px 28px 20px',
          borderBottom:   '1px solid rgba(255,255,255,0.07)',
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.4))',
                border: '1px solid rgba(124,58,237,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#a855f7',
              }}>N</div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
                Neurotek Studio
              </h1>
            </div>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
              Start a new project or continue where you left off.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 20, padding: 4 }}
            title="Close (Esc)"
          >×</button>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => applyProject(buildDefaultProject())}
              style={{
                flex:         1,
                padding:      '12px 16px',
                borderRadius: 10,
                background:   'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))',
                border:       '1px solid rgba(124,58,237,0.4)',
                color:        '#a855f7',
                fontSize:     13,
                fontWeight:   700,
                cursor:       'pointer',
                transition:   'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))' }}
            >
              + New Project
            </button>
            <button
              onClick={openExisting}
              style={{
                flex:         1,
                padding:      '12px 16px',
                borderRadius: 10,
                background:   'rgba(255,255,255,0.03)',
                border:       '1px solid rgba(255,255,255,0.1)',
                color:        '#94a3b8',
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
            >
              Open Project…
            </button>
          </div>

          {/* Templates */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, margin: '0 0 10px' }}>
              Templates
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {templates.map(t => (
                <TemplateCard
                  key={t.name}
                  icon={t.icon}
                  name={t.name}
                  sub={t.sub}
                  bpm={t.bpm}
                  tracks={t.tracks}
                  color={t.color}
                  onPick={() => applyProject(t.build())}
                />
              ))}
            </div>
          </div>

          {/* Recent projects */}
          {recents.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                Recent
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recents.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display:     'flex',
                      alignItems:  'center',
                      gap:         10,
                      padding:     '8px 12px',
                      borderRadius: 8,
                      background:  'rgba(255,255,255,0.02)',
                      border:      '1px solid rgba(255,255,255,0.05)',
                      cursor:      'default',
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                      <rect x={1} y={1} width={12} height={12} rx={2} stroke="#334155" strokeWidth={1.5}/>
                      <rect x={3} y={4} width={5} height={1.5} rx={0.5} fill="#475569"/>
                      <rect x={3} y={7} width={8} height={1.5} rx={0.5} fill="#475569"/>
                      <rect x={3} y={10} width={6} height={1.5} rx={0.5} fill="#334155"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 12, color: '#94a3b8' }}>{r.name}</span>
                    <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{r.bpm} BPM</span>
                    <span style={{ fontSize: 10, color: '#334155' }}>{r.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={dontShow}
                onChange={e => setDontShow(e.target.checked)}
                style={{ accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: 11, color: '#475569' }}>Don't show again</span>
            </label>
            <button
              onClick={onClose}
              style={{
                padding:     '6px 14px',
                borderRadius: 6,
                background:  'transparent',
                border:      '1px solid rgba(255,255,255,0.08)',
                color:       '#475569',
                fontSize:    11,
                cursor:      'pointer',
              }}
            >
              Skip — Open Current Project
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

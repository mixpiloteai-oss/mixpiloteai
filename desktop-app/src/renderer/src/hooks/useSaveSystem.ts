import { useEffect, useRef } from 'react'
import { getAutoSaveEngine }    from '../audio/save/AutoSaveEngine'
import { getProjectSerializer } from '../audio/save/ProjectSerializer'
import { useSaveStore }         from '../store/saveStore'
import { useProjectStore }      from '../store/projectStore'
import { useTransportStore }    from '../store/transportStore'
import { usePianoRollStore }    from '../components/piano-roll/usePianoRollStore'
import { useMixerStore }        from '../components/mixer/useMixerStore'

// ─── useSaveSystem ─────────────────────────────────────────────────────────────
// Mount once in DAWShell.  Initialises the AutoSaveEngine, wires dirty-tracking,
// handles Ctrl+S / trigger-save, and persists a crash checkpoint on every save.

export function useSaveSystem(): void {
  const setStatus = useSaveStore(s => s.setStatus)
  const inited    = useRef(false)

  // ── Init engine ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const engine = getAutoSaveEngine()
    engine.setOnStatus(setStatus)
    engine.init(30).catch(console.error)
    return () => engine.destroy()
  }, [setStatus])

  // ── Dirty tracking — mark engine dirty on any relevant store change ─────────
  const projectRev  = useProjectStore(s => s.project)
  const bpm         = useTransportStore(s => s.bpm)
  const looping     = useTransportStore(s => s.looping)
  const notes       = usePianoRollStore(s => s.notes)
  const mixChannels = useMixerStore(s => s.channels)

  useEffect(() => {
    if (!inited.current) { inited.current = true; return }
    getAutoSaveEngine().markDirty()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRev, bpm, looping, notes, mixChannels])

  // ── Keyboard Ctrl+S ─────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void getAutoSaveEngine().saveNow('Manual save')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Electron trigger-save (menu File → Save) ─────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.onTriggerSave(() => void getAutoSaveEngine().saveNow('Manual save'))
    return () => api.removeAllListeners('trigger-save')
  }, [])

  // ── Power-suspend → emergency save ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.onPowerEvent((evt) => {
      if (evt === 'suspend') void getAutoSaveEngine().saveNow('Power suspend')
    })
    return () => api.removeAllListeners('power-event')
  }, [])

  // ── Keep crash checkpoint up-to-date on every engine save ───────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    // Override saveNow to also push crash checkpoint
    const originalSave = getAutoSaveEngine().saveNow.bind(getAutoSaveEngine())
    getAutoSaveEngine().saveNow = async (label?: string) => {
      await originalSave(label)
      // After save, persist checkpoint via dedicated IPC (best-effort)
      try {
        const snap = await getAutoSaveEngine().loadLatest()
        if (snap) await api.crashSaveCheckpoint(snap)
      } catch { /* ignore */ }
    }
  }, [])

  // ── On visibility change (tab hidden) → save ────────────────────────────────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        const ser = getProjectSerializer()
        const snap = ser.makeSnapshot('Background suspend', 'auto')
        window.electronAPI?.crashSaveCheckpoint(snap).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
}

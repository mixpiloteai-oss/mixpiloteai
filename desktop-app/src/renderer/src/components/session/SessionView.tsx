import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useClipStore }      from '../../store/clipStore'
import { useProjectStore }   from '../../store/projectStore'
import { SessionToolbar }    from './SessionToolbar'
import { TrackHeader }       from './TrackHeader'
import { SceneRow }          from './SceneRow'
import { ClipCell }          from './ClipCell'
import { clipProgress }      from '../../audio/clip/ClipScheduler'
import type { Quantization } from '../../audio/clip/ClipScheduler'

// ─── Inline types (used locally; mirrors clipStore shapes) ────────────────────

interface TrackInfo {
  id:      string
  name:    string
  color:   string
  gainDb:  number
  muted:   boolean
}

interface ClipInfo {
  id:           string
  name:         string
  color:        string
  state:        'empty' | 'stopped' | 'queued' | 'playing' | 'recording'
  launchMode:   'trigger' | 'gate' | 'toggle' | 'repeat'
  followAction: 'none' | 'stop' | 'again' | 'next' | 'prev' | 'first' | 'last' | 'any'
  looping:      boolean
  type:         'midi' | 'audio' | 'empty'
  noteCount?:   number
  progress:     number
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SCENE_ROW_WIDTH  = 120
const CELL_WIDTH       = 110
const TRACK_HEADER_H   = 80
const CELL_HEIGHT      = 72

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxMenuState {
  x:      number
  y:      number
  clipId: string
}

// ─── SessionView ──────────────────────────────────────────────────────────────

export default function SessionView(): React.JSX.Element {
  // ── Clip store ──────────────────────────────────────────────────────────────
  const clips              = useClipStore(s => s.clips)
  const scenes             = useClipStore(s => s.scenes)
  const trackIds           = useClipStore(s => s.trackIds)
  const globalQuantization = useClipStore(s => s.globalQuantization)
  const selectedClip       = useClipStore(s => s.selectedClip)
  const playingScene       = useClipStore(s => s.playingScene)
  const setClipState       = useClipStore(s => s.setClipState)
  const setGlobalQuant     = useClipStore(s => s.setGlobalQuantization)
  const addScene           = useClipStore(s => s.addScene)
  const renameScene        = useClipStore(s => s.renameScene)
  const setPlayingScene    = useClipStore(s => s.setPlayingScene)
  const selectClip         = useClipStore(s => s.selectClip)
  const getClipAt          = useClipStore(s => s.getClipAt)
  const removeClip         = useClipStore(s => s.removeClip)
  const duplicateClip      = useClipStore(s => s.duplicateClip)
  const updateClip         = useClipStore(s => s.updateClip)

  // ── Project store (BPM + track metadata) ───────────────────────────────────
  const projectTracks  = useProjectStore(s => s.project.tracks)
  const bpm            = useProjectStore(s => s.project.bpm ?? 120)
  const setTrackGain   = useProjectStore(s => s.setTrackGain)
  const toggleMute     = useProjectStore(s => s.toggleMute)

  // ── Build TrackInfo from project tracks, falling back to clip store IDs ────
  const trackInfos: TrackInfo[] = trackIds.map(tid => {
    const pt = projectTracks.find(t => t.id === tid)
    return {
      id:     tid,
      name:   pt ? pt.name    : tid,
      color:  pt ? pt.color   : '#7c3aed',
      gainDb: pt ? pt.gainDb  : 0,
      muted:  pt ? pt.muted   : false,
    }
  })

  // ── Progress tracking ───────────────────────────────────────────────────────
  // For each playing clip: record wall-clock start time (ms)
  const startTimes  = useRef<Record<string, number>>({})
  const rafRef      = useRef<number | null>(null)

  // progressMap: clipId -> progress 0..1, drives ClipCell bottom bar
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})

  // Watch clip state changes to record start times
  useEffect(() => {
    for (const clip of Object.values(clips)) {
      if (clip.state === 'playing' && startTimes.current[clip.id] === undefined) {
        startTimes.current[clip.id] = performance.now() / 1000
      }
      if (clip.state !== 'playing' && startTimes.current[clip.id] !== undefined) {
        delete startTimes.current[clip.id]
      }
    }
  }, [clips])

  // rAF loop to update progress
  useEffect(() => {
    const tick = (): void => {
      const now    = performance.now() / 1000
      const update: Record<string, number> = {}
      let   hasPlaying = false

      for (const [clipId, startTime] of Object.entries(startTimes.current)) {
        const clip = clips[clipId]
        if (!clip) continue
        const lengthBeats =
          clip.data.type === 'midi' || clip.data.type === 'audio'
            ? clip.data.lengthBeats
            : 4
        const p = clipProgress(startTime, lengthBeats, bpm, now)
        update[clipId] = p
        hasPlaying = true
      }

      if (hasPlaying) {
        setProgressMap(prev => ({ ...prev, ...update }))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [clips, bpm])

  // ── Context menu state ─────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (): void => closeCtxMenu()
    window.addEventListener('click', handler)
    window.addEventListener('contextmenu', handler)
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('contextmenu', handler)
    }
  }, [ctxMenu, closeCtxMenu])

  // ── Clip click: toggle play/stop (simplified demo wiring) ─────────────────
  const handleClipClick = useCallback((sceneId: string, trackId: string) => {
    const clip = getClipAt(sceneId, trackId)
    if (!clip) return

    if (clip.state === 'playing') {
      setClipState(clip.id, 'stopped')
      delete startTimes.current[clip.id]
    } else if (clip.state === 'stopped' || clip.state === 'queued') {
      setClipState(clip.id, 'playing')
      startTimes.current[clip.id] = performance.now() / 1000
    } else if (clip.state === 'empty') {
      // do nothing for empty
    }
  }, [getClipAt, setClipState])

  const handleClipRightClick = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, clipId })
  }, [])

  const handleClipDoubleClick = useCallback((sceneId: string, trackId: string) => {
    const clip = getClipAt(sceneId, trackId)
    if (!clip) return
    selectClip(clip.id)
  }, [getClipAt, selectClip])

  // ── Scene launch: play all clips in row ────────────────────────────────────
  const handleSceneLaunch = useCallback((sceneId: string) => {
    setPlayingScene(sceneId)
    const now = performance.now() / 1000
    for (const clip of Object.values(clips)) {
      if (clip.sceneId !== sceneId) continue
      if (clip.state !== 'empty') {
        setClipState(clip.id, 'playing')
        startTimes.current[clip.id] = now
      }
    }
  }, [clips, setClipState, setPlayingScene])

  // ── Scene stop ─────────────────────────────────────────────────────────────
  const handleSceneStop = useCallback((sceneId: string) => {
    if (playingScene === sceneId) setPlayingScene(null)
    for (const clip of Object.values(clips)) {
      if (clip.sceneId !== sceneId) continue
      if (clip.state === 'playing' || clip.state === 'queued') {
        setClipState(clip.id, 'stopped')
        delete startTimes.current[clip.id]
      }
    }
  }, [clips, playingScene, setClipState, setPlayingScene])

  // ── Stop all ───────────────────────────────────────────────────────────────
  const handleStopAll = useCallback(() => {
    setPlayingScene(null)
    startTimes.current = {}
    for (const clip of Object.values(clips)) {
      if (clip.state === 'playing' || clip.state === 'queued' || clip.state === 'recording') {
        setClipState(clip.id, 'stopped')
      }
    }
  }, [clips, setClipState, setPlayingScene])

  // ── Build ClipInfo for a given scene/track slot ────────────────────────────
  const buildClipInfo = useCallback((sceneId: string, trackId: string): ClipInfo | undefined => {
    const clip = getClipAt(sceneId, trackId)
    if (!clip) return undefined
    const noteCount =
      clip.data.type === 'midi'
        ? clip.data.notes.length
        : undefined
    return {
      id:           clip.id,
      name:         clip.name,
      color:        clip.color,
      state:        clip.state,
      launchMode:   clip.launchMode,
      followAction: clip.followAction,
      looping:      clip.looping,
      type:         clip.data.type,
      noteCount,
      progress:     progressMap[clip.id] ?? 0,
    }
  }, [getClipAt, progressMap])

  // ── Context menu actions ───────────────────────────────────────────────────
  const handleCtxAction = useCallback((action: string) => {
    if (!ctxMenu) return
    const { clipId } = ctxMenu

    switch (action) {
      case 'delete':
        removeClip(clipId)
        break
      case 'duplicate':
        duplicateClip(clipId)
        break
      case 'rename': {
        const newName = prompt('New clip name:', clips[clipId]?.name ?? 'Clip')
        if (newName?.trim()) updateClip(clipId, { name: newName.trim() })
        break
      }
      case 'loop-toggle': {
        const clip = clips[clipId]
        if (clip) updateClip(clipId, { looping: !clip.looping })
        break
      }
    }

    closeCtxMenu()
  }, [ctxMenu, clips, removeClip, duplicateClip, updateClip, closeCtxMenu])

  // ── Layout ─────────────────────────────────────────────────────────────────
  const trackCount = trackIds.length
  const sceneCount = scenes.length

  const gridCols = `${SCENE_ROW_WIDTH}px repeat(${trackCount}, ${CELL_WIDTH}px)`
  const gridRows = `${TRACK_HEADER_H}px repeat(${sceneCount}, ${CELL_HEIGHT}px)`

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        background:    '#08080f',
        overflow:      'hidden',
      }}
      onClick={ctxMenu ? closeCtxMenu : undefined}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <SessionToolbar
        bpm={bpm}
        globalQuantization={globalQuantization as Quantization}
        sceneCount={sceneCount}
        onSetQuantization={setGlobalQuant}
        onStopAll={handleStopAll}
        onAddScene={() => addScene()}
      />

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display:               'grid',
            gridTemplateColumns:   gridCols,
            gridTemplateRows:      gridRows,
            width:                 'max-content',
            minWidth:              '100%',
          }}
        >
          {/* ── Corner cell (top-left, above scene labels) ─────────────────── */}
          <div
            style={{
              gridColumn:  1,
              gridRow:     1,
              width:       SCENE_ROW_WIDTH,
              height:      TRACK_HEADER_H,
              background:  '#0b0b14',
              borderRight: '1px solid #15152a',
              borderBottom: '1px solid #15152a',
              display:     'flex',
              alignItems:  'flex-end',
              padding:     '0 8px 8px',
            }}
          >
            <span
              style={{
                fontSize:      8,
                color:         '#2d2d42',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily:    'monospace',
              }}
            >
              Scenes
            </span>
          </div>

          {/* ── Track headers ────────────────────────────────────────────────── */}
          {trackInfos.map((track, ti) => (
            <div
              key={track.id}
              style={{
                gridColumn: ti + 2,
                gridRow:    1,
              }}
            >
              <TrackHeader
                track={track}
                width={CELL_WIDTH}
                onSetGain={(db) => setTrackGain(track.id, db)}
                onToggleMute={() => toggleMute(track.id)}
              />
            </div>
          ))}

          {/* ── Scene rows + clip cells ───────────────────────────────────────── */}
          {scenes.map((scene, si) => (
            <React.Fragment key={scene.id}>
              {/* Scene label / launch */}
              <div
                style={{
                  gridColumn: 1,
                  gridRow:    si + 2,
                }}
              >
                <SceneRow
                  scene={scene}
                  isPlaying={playingScene === scene.id}
                  onLaunch={() => handleSceneLaunch(scene.id)}
                  onStop={() => handleSceneStop(scene.id)}
                  onRename={(name) => renameScene(scene.id, name)}
                />
              </div>

              {/* Clip cells for each track */}
              {trackIds.map((trackId, ti) => {
                const clipInfo = buildClipInfo(scene.id, trackId)
                const clipId   = clipInfo?.id ?? `${scene.id}::${trackId}`

                return (
                  <div
                    key={`${scene.id}-${trackId}`}
                    style={{
                      gridColumn: ti + 2,
                      gridRow:    si + 2,
                    }}
                  >
                    <ClipCell
                      clip={clipInfo}
                      sceneId={scene.id}
                      trackId={trackId}
                      width={CELL_WIDTH}
                      height={CELL_HEIGHT}
                      isSelected={selectedClip === (clipInfo?.id ?? null)}
                      onClick={() => handleClipClick(scene.id, trackId)}
                      onRightClick={(e) => {
                        if (clipInfo) handleClipRightClick(e, clipInfo.id)
                        else e.preventDefault()
                      }}
                      onDoubleClick={() => handleClipDoubleClick(scene.id, trackId)}
                    />
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Context menu ────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position:     'fixed',
            left:         ctxMenu.x,
            top:          ctxMenu.y,
            zIndex:       9999,
            background:   '#0d0d1a',
            border:       '1px solid #15152a',
            borderRadius: 6,
            padding:      '4px 0',
            minWidth:     140,
            boxShadow:    '0 8px 24px rgba(0,0,0,0.60)',
          }}
        >
          {([
            { key: 'rename',       label: 'Rename' },
            { key: 'duplicate',    label: 'Duplicate' },
            { key: 'loop-toggle',  label: clips[ctxMenu.clipId]?.looping ? 'Disable Loop' : 'Enable Loop' },
            null,
            { key: 'delete',       label: 'Delete' },
          ] as (null | { key: string; label: string })[]).map((item, i) => {
            if (item === null) {
              return (
                <div
                  key={`sep-${i}`}
                  style={{
                    height:     1,
                    background: '#15152a',
                    margin:     '3px 0',
                  }}
                />
              )
            }
            return (
              <button
                key={item.key}
                onClick={() => handleCtxAction(item.key)}
                style={{
                  display:    'block',
                  width:      '100%',
                  textAlign:  'left',
                  padding:    '5px 12px',
                  background: 'transparent',
                  border:     'none',
                  color:      item.key === 'delete' ? '#ef4444' : '#94a3b8',
                  fontSize:   11,
                  cursor:     'pointer',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  const t = e.currentTarget as HTMLButtonElement
                  t.style.background = 'rgba(255,255,255,0.06)'
                  t.style.color = item.key === 'delete' ? '#f87171' : '#e2e8f0'
                }}
                onMouseLeave={e => {
                  const t = e.currentTarget as HTMLButtonElement
                  t.style.background = 'transparent'
                  t.style.color = item.key === 'delete' ? '#ef4444' : '#94a3b8'
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

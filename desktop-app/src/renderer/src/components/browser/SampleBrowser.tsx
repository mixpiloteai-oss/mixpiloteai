import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useBrowserStore } from '../../store/browserStore'
import { getFileScanner }  from '../../audio/browser/FileScanner'
import { getSampleIndexer } from '../../audio/browser/SampleIndexer'
import { getAudioAnalyzer } from '../../audio/browser/AudioAnalyzer'
import { getAudioCache }   from '../../audio/browser/AudioCache'
import type { SampleSort, SampleEntry } from '../../audio/browser/types'
import FolderTree    from './FolderTree'
import SearchBar     from './SearchBar'
import FilterPanel   from './FilterPanel'
import SampleList    from './SampleList'
import WaveformPreview from './WaveformPreview'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#08080f',
  toolbar:     '#0b0b14',
  border:      'rgba(255,255,255,0.06)',
  text:        '#94a3b8',
  textMuted:   '#4b5a7a',
  btnBg:       'rgba(255,255,255,0.04)',
  btnBorder:   'rgba(255,255,255,0.07)',
  btnHover:    'rgba(255,255,255,0.08)',
  btnActive:   'rgba(124,58,237,0.22)',
  btnText:     '#94a3b8',
  btnActiveBdr:'rgba(124,58,237,0.5)',
  btnActiveTxt:'#c4b5fd',
  accentPurple:'#7c3aed',
  progress:    '#7c3aed',
  progressBg:  'rgba(255,255,255,0.06)',
  scanText:    '#64748b',
  scanFile:    '#475569',
  addBtn:      'rgba(124,58,237,0.15)',
  addBtnBdr:   'rgba(124,58,237,0.35)',
  addBtnText:  '#a78bfa',
} as const

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS: ReadonlyArray<{ value: SampleSort; label: string }> = [
  { value: 'name',     label: 'Name'     },
  { value: 'date',     label: 'Date'     },
  { value: 'duration', label: 'Duration' },
  { value: 'bpm',      label: 'BPM'      },
  { value: 'key',      label: 'Key'      },
  { value: 'size',     label: 'Size'     },
]

// ─── Scan progress bar ────────────────────────────────────────────────────────
interface ScanProgressBarProps {
  scanned: number
  total:   number
  current: string
}

function ScanProgressBar({ scanned, total, current }: ScanProgressBarProps): React.ReactElement {
  const pct = total > 0 ? Math.round((scanned / total) * 100) : 0
  const barW = total > 0 ? `${pct}%` : '0%'
  const fileName = current.split('/').pop() ?? current

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         10,
      padding:     '0 12px',
      height:      30,
      background:  C.toolbar,
      borderBottom: `1px solid ${C.border}`,
      flexShrink:  0,
      overflow:    'hidden',
    }}>
      <span style={{ fontSize: 10, color: C.scanText, flexShrink: 0, userSelect: 'none' }}>
        Scanning...
      </span>

      {/* Progress bar track */}
      <div style={{
        flex:         1,
        height:       4,
        background:   C.progressBg,
        borderRadius: 2,
        overflow:     'hidden',
        minWidth:     60,
        flexShrink:   1,
      }}>
        <div style={{
          width:        barW,
          height:       '100%',
          background:   C.progress,
          borderRadius: 2,
          transition:   'width 0.2s ease',
        }} />
      </div>

      <span style={{ fontSize: 10, color: C.text, flexShrink: 0, userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}>
        {scanned.toLocaleString()} / {total.toLocaleString()} &nbsp; {pct}%
      </span>

      {fileName && (
        <span style={{
          fontSize:     10,
          color:        C.scanFile,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          maxWidth:     200,
          flexShrink:   1,
          userSelect:   'none',
        }}>
          {fileName}
        </span>
      )}
    </div>
  )
}

// ─── SampleBrowser ────────────────────────────────────────────────────────────
export default function SampleBrowser(): React.ReactElement {
  const {
    samples,
    filter,
    sort,
    sortDir,
    selectedId,
    selectedFolder,
    scanning,
    scanProgress,
    waveformVisible,
    sidebarWidth,
    setSamples,
    setFolderTree,
    setScanning,
    setScanProgress,
    updateSample,
    setSort,
  } = useBrowserStore()

  const [showFilters, setShowFilters] = useState<boolean>(false)

  // ── On mount: hydrate from IndexedDB ──────────────────────────────────────
  useEffect(() => {
    getAudioCache().open().then(async () => {
      const cached = await getAudioCache().getAll()
      if (cached.length > 0) {
        getSampleIndexer().load(cached)
        setSamples(cached)
        setFolderTree(getFileScanner().buildFolderTree(cached))
      }
    }).catch(() => { /* IndexedDB unavailable */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Computed displayed samples ────────────────────────────────────────────
  const displayedSamples: SampleEntry[] = useMemo(() => {
    const results = getSampleIndexer().search(filter, sort, sortDir)
    if (!selectedFolder) return results
    return results.filter(
      (s) => s.path.startsWith(selectedFolder + '/') || s.path.startsWith(selectedFolder),
    )
  }, [samples, filter, sort, sortDir, selectedFolder])

  // ── Add folder handler ────────────────────────────────────────────────────
  const handleAddFolder = useCallback(async (): Promise<void> => {
    if (scanning) return
    setScanning(true)
    try {
      const scanner = getFileScanner()
      const entries = await scanner.pickAndScan((p) => setScanProgress(p))
      getSampleIndexer().load(entries)
      setSamples(entries)
      setFolderTree(scanner.buildFolderTree(entries))
      // Start background analysis
      getAudioAnalyzer().enqueue(entries, (result) => {
        updateSample(result.id, { ...result, analyzed: true })
        getSampleIndexer().update(result.id, { ...result, analyzed: true })
      })
    } catch {
      // User dismissed picker or error
    } finally {
      setScanning(false)
      setScanProgress(null)
    }
  }, [scanning, setScanning, setScanProgress, setSamples, setFolderTree, updateSample])

  // ── Sort select handler ───────────────────────────────────────────────────
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SampleSort
    setSort(value)
  }, [setSort])

  // ── Sort dir toggle ───────────────────────────────────────────────────────
  const handleSortDirToggle = useCallback(() => {
    setSort(sort) // same sort → toggles dir
  }, [setSort, sort])

  // ── Toggle filters ────────────────────────────────────────────────────────
  const handleToggleFilters = useCallback(() => {
    setShowFilters((v) => !v)
  }, [])

  // ── Selected sample for waveform ──────────────────────────────────────────
  const selectedSample: SampleEntry | undefined = useMemo(
    () => samples.find((s) => s.id === selectedId),
    [samples, selectedId],
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height:        '100%',
      display:       'flex',
      flexDirection: 'column',
      background:    C.bg,
      overflow:      'hidden',
    }}>
      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div style={{
        height:       38,
        flexShrink:   0,
        background:   C.toolbar,
        borderBottom: `1px solid ${C.border}`,
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '0 12px',
        boxSizing:    'border-box',
      }}>
        {/* Add folder */}
        <button
          onClick={handleAddFolder}
          disabled={scanning}
          title="Add a folder of samples"
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          5,
            height:       26,
            padding:      '0 10px',
            background:   C.addBtn,
            border:       `1px solid ${C.addBtnBdr}`,
            borderRadius: 5,
            color:        C.addBtnText,
            fontSize:     11,
            cursor:       scanning ? 'wait' : 'pointer',
            flexShrink:   0,
            whiteSpace:   'nowrap',
            fontFamily:   'inherit',
            userSelect:   'none',
            opacity:      scanning ? 0.5 : 1,
            transition:   'opacity 0.15s',
          }}
        >
          + Add folder
        </button>

        {/* Search bar (flex 1) */}
        <SearchBar
          onToggleFilters={handleToggleFilters}
          filtersActive={showFilters}
        />

        {/* Sort select */}
        <select
          value={sort}
          onChange={handleSortChange}
          title="Sort by"
          style={{
            height:       26,
            padding:      '0 6px',
            background:   C.btnBg,
            border:       `1px solid ${C.btnBorder}`,
            borderRadius: 5,
            color:        C.btnText,
            fontSize:     11,
            cursor:       'pointer',
            fontFamily:   'inherit',
            outline:      'none',
            flexShrink:   0,
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Sort direction toggle */}
        <button
          onClick={handleSortDirToggle}
          title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
          style={{
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            width:        26,
            height:       26,
            background:   C.btnBg,
            border:       `1px solid ${C.btnBorder}`,
            borderRadius: 5,
            color:        C.btnText,
            fontSize:     13,
            cursor:       'pointer',
            flexShrink:   0,
            fontFamily:   'inherit',
            userSelect:   'none',
            transition:   'background 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = C.btnHover
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = C.btnBg
          }}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* ── SCAN PROGRESS ────────────────────────────────────────────────── */}
      {scanning && scanProgress !== null && (
        <ScanProgressBar
          scanned={scanProgress.scanned}
          total={scanProgress.total}
          current={scanProgress.current}
        />
      )}

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex:     1,
        display:  'flex',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Sidebar: folder tree */}
        <div style={{
          width:       sidebarWidth,
          flexShrink:  0,
          borderRight: `1px solid ${C.border}`,
          overflowY:   'auto',
          overflowX:   'hidden',
          display:     'flex',
          flexDirection: 'column',
          background:  C.bg,
          scrollbarWidth: 'thin',
          scrollbarColor: `rgba(255,255,255,0.06) transparent`,
        }}>
          <FolderTree />
        </div>

        {/* Main area */}
        <div style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          minWidth:      0,
        }}>
          {/* Filter panel (collapsible) */}
          {showFilters && <FilterPanel />}

          {/* Count + sort info bar */}
          <div style={{
            height:       28,
            flexShrink:   0,
            display:      'flex',
            alignItems:   'center',
            padding:      '0 12px',
            gap:          8,
            background:   C.toolbar,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{
              fontSize:   10,
              color:      C.textMuted,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {displayedSamples.length.toLocaleString()}
              {displayedSamples.length !== samples.length && (
                <span style={{ color: '#374151' }}> / {samples.length.toLocaleString()}</span>
              )}
              {' '}samples
            </span>

            <span style={{ color: C.border, userSelect: 'none', fontSize: 10 }}>·</span>

            <span style={{ fontSize: 10, color: '#374151', userSelect: 'none' }}>
              {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort}
              {' '}{sortDir === 'asc' ? '↑' : '↓'}
            </span>
          </div>

          {/* Virtualized sample list */}
          <SampleList samples={displayedSamples} />
        </div>
      </div>

      {/* ── WAVEFORM PREVIEW ─────────────────────────────────────────────── */}
      {waveformVisible && (
        <div style={{
          height:    80,
          flexShrink: 0,
          borderTop: `1px solid ${C.border}`,
          overflow:  'hidden',
          display:   selectedId !== null ? 'block' : 'none',
        }}>
          <WaveformPreview entry={selectedSample ?? null} />
        </div>
      )}
    </div>
  )
}

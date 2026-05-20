import { useState, useEffect } from 'react'

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'

interface UpdateAvailableInfo { version: string; releaseDate?: string; releaseNotes?: unknown }
interface UpdateProgressInfo  { percent: number; transferred: number; total: number; bytesPerSecond: number }
interface UpdateDownloadedInfo { version: string }
interface UpdateErrorInfo { message: string }

const SESSION_KEY = 'update-banner-dismissed'

export default function UpdateBanner() {
  const [state, setState]     = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)
  const [error, setError]     = useState('')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.onUpdateAvailable?.((info: unknown) => {
      const i = info as UpdateAvailableInfo
      if (sessionStorage.getItem(SESSION_KEY)) return
      setVersion(i.version)
      setState('available')
      setVisible(true)
    })

    api.onUpdateProgress?.((info: unknown) => {
      const i = info as UpdateProgressInfo
      setPercent(i.percent)
      setState('downloading')
      setVisible(true)
    })

    api.onUpdateDownloaded?.((info: unknown) => {
      const i = info as UpdateDownloadedInfo
      setVersion(i.version)
      setState('downloaded')
      setVisible(true)
    })

    api.onUpdateError?.((info: unknown) => {
      const i = info as UpdateErrorInfo
      setError(i.message)
      setState('error')
      setVisible(true)
    })
  }, [])

  if (!visible || state === 'idle') return null

  function handleDownload() {
    setState('downloading')
    setPercent(0)
    window.electronAPI?.downloadUpdate?.()
  }

  function handleInstall() {
    window.electronAPI?.installUpdate?.()
  }

  function handleLater() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  function handleDismissError() {
    setState('idle')
    setVisible(false)
  }

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    background: '#0c0c18',
    borderBottom: '1px solid #8b5cf640',
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'inherit',
  }

  const accentStyle: React.CSSProperties = {
    color: '#8b5cf6',
    fontWeight: 600,
  }

  const btnPrimaryStyle: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#8b5cf6',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnGhostStyle: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 6,
    border: '1px solid #8b5cf640',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 11,
    cursor: 'pointer',
  }

  const spacer = <div style={{ flex: 1 }} />

  if (state === 'available') {
    return (
      <div style={bannerStyle}>
        <span>Update</span>
        <span style={accentStyle}>v{version}</span>
        <span>available</span>
        {spacer}
        <button style={btnPrimaryStyle} onClick={handleDownload}>Download</button>
        <button style={btnGhostStyle}   onClick={handleLater}>Later</button>
      </div>
    )
  }

  if (state === 'downloading') {
    return (
      <div style={bannerStyle}>
        <span>Downloading update…</span>
        <div style={{ flex: 1, height: 4, background: '#1c1c2e', borderRadius: 2, overflow: 'hidden', minWidth: 100 }}>
          <div style={{ width: `${percent}%`, height: '100%', background: '#8b5cf6', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ minWidth: 36, textAlign: 'right', color: '#94a3b8' }}>{percent}%</span>
      </div>
    )
  }

  if (state === 'downloaded') {
    return (
      <div style={bannerStyle}>
        <span>Update</span>
        <span style={accentStyle}>v{version}</span>
        <span>ready to install</span>
        {spacer}
        <button style={btnPrimaryStyle} onClick={handleInstall}>Restart Now</button>
        <button style={btnGhostStyle}   onClick={handleLater}>Later</button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ ...bannerStyle, borderBottomColor: '#ef444440' }}>
        <span style={{ color: '#ef4444' }}>Update check failed:</span>
        <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{error}</span>
        {spacer}
        <button style={btnGhostStyle} onClick={handleDismissError}>Dismiss</button>
      </div>
    )
  }

  return null
}

/**
 * BackupManagerPanel — panel for listing, restoring, and deleting project backups.
 */

import { useSafetyStore } from '../../store/safetyStore'
import type { BackupEntry } from '../../audio/safety/RecoveryManager'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

interface BackupRowProps {
  entry: BackupEntry
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

function BackupRow({ entry, onRestore, onDelete }: BackupRowProps): JSX.Element {
  const handleDelete = (): void => {
    if (window.confirm(`Delete backup "${entry.projectName}" from ${formatDate(entry.savedAt)}?`)) {
      onDelete(entry.id)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.04)',
      marginBottom: 6,
      gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{entry.projectName}</div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {formatDate(entry.savedAt)} &middot; {formatSize(entry.size)}
          {entry.isCrashRecovery && (
            <span style={{
              marginLeft: 6,
              padding: '1px 6px',
              borderRadius: 3,
              background: '#f59e0b22',
              color: '#f59e0b',
              fontSize: 10,
            }}>
              CRASH
            </span>
          )}
          {entry.checksumValid ? (
            <span style={{
              marginLeft: 4,
              padding: '1px 6px',
              borderRadius: 3,
              background: '#10b98122',
              color: '#10b981',
              fontSize: 10,
            }}>
              OK
            </span>
          ) : (
            <span style={{
              marginLeft: 4,
              padding: '1px 6px',
              borderRadius: 3,
              background: '#ef444422',
              color: '#ef4444',
              fontSize: 10,
            }}>
              CORRUPT
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onRestore(entry.id)}
          style={{
            padding: '5px 12px',
            borderRadius: 4,
            background: '#6c47ff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Restore
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: '5px 12px',
            borderRadius: 4,
            background: 'transparent',
            color: '#ef4444',
            border: '1px solid #ef444455',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

const INTERVAL_OPTIONS: { label: string; ms: number }[] = [
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 300_000 },
]

export function BackupManagerPanel(): JSX.Element {
  const {
    backups,
    isLoadingBackups,
    autosaveEnabled,
    autosaveIntervalMs,
    saveStatus,
    loadBackups,
    restoreSnapshot,
    deleteBackup,
    setAutosaveEnabled,
    setAutosaveInterval,
    forceSave,
  } = useSafetyStore()

  return (
    <div style={{ padding: 20, color: '#fff', maxWidth: 600 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Backup Manager</h3>

      {/* Load / Refresh */}
      <button
        onClick={() => void loadBackups()}
        disabled={isLoadingBackups}
        style={{
          padding: '7px 16px',
          borderRadius: 4,
          background: '#333',
          color: '#fff',
          border: 'none',
          cursor: isLoadingBackups ? 'not-allowed' : 'pointer',
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        {isLoadingBackups ? 'Loading...' : 'Load Backups'}
      </button>

      {/* Backup list */}
      {backups.length === 0 ? (
        <p style={{ color: '#666', fontSize: 13 }}>No backups found. Click &quot;Load Backups&quot; to refresh.</p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {backups.map(entry => (
            <BackupRow
              key={entry.id}
              entry={entry}
              onRestore={(id) => void restoreSnapshot(id)}
              onDelete={(id) => void deleteBackup(id)}
            />
          ))}
        </div>
      )}

      {/* Autosave Settings */}
      <div style={{ borderTop: '1px solid #333', paddingTop: 16, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Autosave Settings</h4>

        {/* Enabled toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autosaveEnabled}
            onChange={e => setAutosaveEnabled(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>Autosave enabled</span>
        </label>

        {/* Interval selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#aaa' }}>Interval:</span>
          {INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.ms}
              onClick={() => setAutosaveInterval(opt.ms)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: autosaveIntervalMs === opt.ms ? '#6c47ff' : '#2a2a3e',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Force Save */}
      <button
        onClick={() => void forceSave()}
        disabled={saveStatus === 'saving'}
        style={{
          padding: '8px 18px',
          borderRadius: 4,
          background: '#10b981',
          color: '#fff',
          border: 'none',
          cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          fontSize: 13,
        }}
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Force Save Now'}
      </button>
    </div>
  )
}

/**
 * RecoveryDialog — blocking modal shown when a crash recovery is detected.
 *
 * Cannot be dismissed by clicking outside; user must make an explicit decision.
 */

import { useSafetyStore } from '../../store/safetyStore'
import type { BackupEntry } from '../../audio/safety/RecoveryManager'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

interface SnapshotRowProps {
  entry: BackupEntry
  onRestore: (id: string) => void
}

function SnapshotRow({ entry, onRestore }: SnapshotRowProps): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.05)',
      marginBottom: 8,
    }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{entry.projectName}</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          {formatDate(entry.savedAt)} &middot; {formatSize(entry.size)}
        </div>
      </div>
      <button
        onClick={() => onRestore(entry.id)}
        style={{
          padding: '6px 14px',
          borderRadius: 4,
          background: '#6c47ff',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Restore this version
      </button>
    </div>
  )
}

export function RecoveryDialog(): JSX.Element | null {
  const { showRecoveryDialog, recoverySnapshots, restoreSnapshot, discardRecovery } = useSafetyStore()

  if (!showRecoveryDialog) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      // Intentionally no onClick on overlay — user must make an explicit decision
    >
      <div
        style={{
          background: '#1a1a2e',
          borderRadius: 10,
          padding: '28px 32px',
          maxWidth: 520,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          color: '#fff',
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>
          [!] Project Recovery
        </h2>
        <p style={{ margin: '0 0 20px', color: '#ccc', fontSize: 14 }}>
          The app did not close properly. We found{' '}
          <strong>{recoverySnapshots.length}</strong> autosaved version
          {recoverySnapshots.length !== 1 ? 's' : ''}.
        </p>

        <div style={{ marginBottom: 20 }}>
          {recoverySnapshots.map(entry => (
            <SnapshotRow key={entry.id} entry={entry} onRestore={restoreSnapshot} />
          ))}
        </div>

        <div style={{ textAlign: 'right' }}>
          <button
            onClick={() => void discardRecovery()}
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              background: 'transparent',
              color: '#888',
              border: '1px solid #555',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Discard &amp; start fresh
          </button>
        </div>
      </div>
    </div>
  )
}

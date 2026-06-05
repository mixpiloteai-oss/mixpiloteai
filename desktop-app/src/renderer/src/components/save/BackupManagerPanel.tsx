/**
 * BackupManagerPanel — list, create, restore, and delete named project backups.
 */

import React, { useState, useEffect } from 'react'
import { useBackupStore } from '../../store/backupStore'
import { getProjectSerializer } from '../../audio/save/ProjectSerializer'
import type { ProjectSnapshot } from '../../audio/save/types'

const TYPE_BADGE: Record<ProjectSnapshot['type'], { label: string; color: string }> = {
  auto:         { label: 'auto',       color: 'bg-neutral-700 text-neutral-300' },
  manual:       { label: 'manual',     color: 'bg-purple-900 text-purple-300' },
  crash:        { label: 'crash',      color: 'bg-red-900 text-red-300' },
  backup:       { label: 'backup',     color: 'bg-cyan-900 text-cyan-300' },
  'pre-action': { label: 'pre-action', color: 'bg-amber-900 text-amber-300' },
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupManagerPanel(): React.ReactElement {
  const { backups, isLoading, lastError, loadBackups, createNamedBackup, restoreBackup, deleteBackup } = useBackupStore()
  const [newLabel, setNewLabel]     = useState('')
  const [showInput, setShowInput]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [restoring, setRestoring]   = useState<string | null>(null)
  const serializer = getProjectSerializer()

  useEffect(() => { void loadBackups() }, [loadBackups])

  async function handleCreate(): Promise<void> {
    const label = newLabel.trim() || `Backup ${new Date().toLocaleString()}`
    await createNamedBackup(label)
    setNewLabel('')
    setShowInput(false)
  }

  async function handleRestore(id: string): Promise<void> {
    setRestoring(id)
    await restoreBackup(id)
    setRestoring(null)
  }

  async function handleDelete(id: string): Promise<void> {
    if (confirmDelete !== id) { setConfirmDelete(id); return }
    await deleteBackup(id)
    setConfirmDelete(null)
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-100 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <span className="font-semibold text-base">Project Backups</span>
        <button
          onClick={() => setShowInput(v => !v)}
          className="px-3 py-1 text-xs bg-purple-700 hover:bg-purple-600 rounded font-medium"
        >
          + Create Backup
        </button>
      </div>

      {/* Create input */}
      {showInput && (
        <div className="flex gap-2 px-4 py-3 border-b border-neutral-700 bg-neutral-800/50">
          <input
            type="text"
            placeholder="Backup name…"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleCreate()}
            className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-3 py-1.5 text-xs placeholder-neutral-500 focus:outline-none focus:border-purple-500"
            autoFocus
          />
          <button
            onClick={() => void handleCreate()}
            className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 rounded"
          >
            Save
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {lastError && (
        <div className="mx-4 mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {lastError}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-neutral-500 text-xs">
            Loading…
          </div>
        )}

        {!isLoading && backups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500 text-xs gap-2">
            <span>No backups yet</span>
            <span>Create a backup to preserve a named project state</span>
          </div>
        )}

        {backups.map(snap => {
          const badge    = TYPE_BADGE[snap.type] ?? TYPE_BADGE['backup']
          const isValid  = serializer.verify(snap)
          const isRestor = restoring === snap.id

          return (
            <div
              key={snap.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium truncate">{snap.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${badge.color}`}>
                    {badge.label}
                  </span>
                  {!isValid && (
                    <span className="text-xs text-red-400" title="Checksum mismatch">⚠ corrupted</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 flex gap-3">
                  <span>{formatRelative(snap.createdAt)}</span>
                  <span>{formatBytes(snap.sizeBytes)}</span>
                </div>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => void handleRestore(snap.id)}
                  disabled={isRestor || !isValid}
                  className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 rounded"
                  title="Restore this backup"
                >
                  {isRestor ? '…' : '↩ Restore'}
                </button>
                <button
                  onClick={() => void handleDelete(snap.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    confirmDelete === snap.id
                      ? 'bg-red-700 hover:bg-red-600 text-white'
                      : 'bg-neutral-700 hover:bg-neutral-600'
                  }`}
                  title={confirmDelete === snap.id ? 'Click again to confirm' : 'Delete backup'}
                >
                  {confirmDelete === snap.id ? 'Confirm?' : '✕'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

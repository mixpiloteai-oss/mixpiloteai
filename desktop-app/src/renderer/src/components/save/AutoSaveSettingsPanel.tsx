/**
 * AutoSaveSettingsPanel — configures autosave interval and shows live status.
 */

import React, { useState } from 'react'
import { useSaveStore } from '../../store/saveStore'
import { getAutoSaveEngine } from '../../audio/save/AutoSaveEngine'

interface IntervalOption {
  label:   string
  seconds: number
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: '10 sec',   seconds: 10 },
  { label: '30 sec',   seconds: 30 },
  { label: '1 min',    seconds: 60 },
  { label: '5 min',    seconds: 300 },
  { label: 'Disabled', seconds: 0 },
]

function formatRelative(ts: number | null): string {
  if (!ts) return 'Never'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)   return 'Just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function AutoSaveSettingsPanel(): React.ReactElement {
  const status      = useSaveStore(s => s.status)
  const [saving, setSaving] = useState(false)
  const [activeInterval, setActiveInterval] = useState(30)

  function handleIntervalChange(seconds: number): void {
    setActiveInterval(seconds)
    if (seconds === 0) {
      // Effectively disabled — very large interval
      getAutoSaveEngine().setInterval(999999)
    } else {
      getAutoSaveEngine().setInterval(seconds)
    }
  }

  async function handleSaveNow(): Promise<void> {
    setSaving(true)
    try {
      await getAutoSaveEngine().saveNow('Manual save')
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = activeInterval === 0

  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 text-neutral-100 text-sm rounded-lg">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-base">Auto-Save Settings</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            status.state === 'saving' ? 'bg-blue-900 text-blue-300' :
            status.state === 'error'  ? 'bg-red-900 text-red-300' :
            status.isDirty            ? 'bg-yellow-900 text-yellow-300' :
                                        'bg-neutral-800 text-neutral-400'
          }`}
        >
          {status.state === 'saving' ? 'Saving…' :
           status.state === 'error'  ? 'Error' :
           status.isDirty            ? 'Unsaved changes' :
                                       'Saved'}
        </span>
      </div>

      {/* Interval selector */}
      <div>
        <div className="text-neutral-400 text-xs mb-2">Auto-Save Interval</div>
        <div className="flex gap-2 flex-wrap">
          {INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.seconds}
              onClick={() => handleIntervalChange(opt.seconds)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeInterval === opt.seconds
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>Last saved: {formatRelative(status.lastSavedAt)}</span>
        {!isDisabled && (
          <span>Next save in: {status.autoSaveIn}s</span>
        )}
      </div>

      {/* Error display */}
      {status.lastError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {status.lastError}
        </div>
      )}

      {/* Save Now button */}
      <button
        onClick={() => void handleSaveNow()}
        disabled={saving}
        className="w-full py-2 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {saving ? 'Saving…' : 'Save Now'}
      </button>
    </div>
  )
}

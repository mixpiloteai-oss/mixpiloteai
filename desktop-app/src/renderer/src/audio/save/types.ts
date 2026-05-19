// ─── Snapshot / Version ───────────────────────────────────────────────────

export interface ProjectSnapshot {
  id:        string       // nanoid-like: timestamp hex + random
  label:     string       // user-defined name or auto "Auto-save #42"
  createdAt: number       // timestamp ms
  type:      'manual' | 'auto' | 'crash' | 'backup' | 'pre-action'
  data:      ProjectSaveData
  checksum:  string       // sha256-like hash of JSON
  sizeBytes: number
  dirty:     boolean      // has unsaved changes since this snapshot
}

export interface ProjectSaveData {
  version:    number       // schema version, start at 1
  savedAt:    number
  appVersion: string       // hardcoded '1.0.0'
  project:    unknown      // ProjectStore state (opaque JSON)
  mixer:      unknown
  transport:  unknown
  pianoRoll:  unknown
  midi:       unknown
}

export interface SaveStatus {
  state:       'idle' | 'saving' | 'error' | 'dirty'
  lastSavedAt: number | null
  lastError:   string | null
  autoSaveIn:  number        // seconds until next auto-save
  isDirty:     boolean
}

export interface RecoveryPoint {
  id:        string
  label:     string
  createdAt: number
  type:      'crash' | 'emergency'
  data:      ProjectSaveData
  recovered: boolean
}

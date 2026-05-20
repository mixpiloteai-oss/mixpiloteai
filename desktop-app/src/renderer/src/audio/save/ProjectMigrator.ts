// ─── Project File Migration Chain ────────────────────────────────────────────
// Transforms saved project data across schema versions before validation.
//
// Schema version history:
//   0 (implicit) — very early format, no `version` field
//   1             — current production format (has version, mixer, transport, pianoRoll, midi)
//
// Migrations run sequentially: 0→1, 1→2, etc.
// Future versions (version > LATEST_SCHEMA_VERSION) cannot be migrated down.

const LATEST_SCHEMA_VERSION = 1

export interface MigrationResult {
  data:          unknown           // migrated data ready for validation
  fromVersion:   number            // schema version of the original file
  toVersion:     number            // schema version after migration
  didMigrate:    boolean           // true if any migration ran
  warnings:      string[]          // non-fatal issues encountered during migration
}

export interface MigrationError {
  error:         string
  fromVersion:   number
}

// Detect schema version from raw parsed JSON (before validation).
function detectVersion(raw: unknown): number {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const obj = raw as Record<string, unknown>
  if (typeof obj.version === 'number' && Number.isInteger(obj.version)) {
    return obj.version
  }
  return 0   // no version field → treat as v0 (legacy)
}

// ── Migration functions (one per version step) ─────────────────────────────────

// v0 → v1: Add all required fields that are missing.
// v0 files have no `version`, possibly no `mixer`/`transport`/`pianoRoll`/`midi` sections.
function migrateV0toV1(raw: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...raw }

  result.version    = 1
  result.savedAt    = typeof raw.savedAt === 'number' ? raw.savedAt : Date.now()
  result.appVersion = typeof raw.appVersion === 'string' ? raw.appVersion : '0.0.0'

  // Preserve existing sections, default missing ones to null
  if (!('mixer'     in result)) { result.mixer     = null; warnings.push('mixer section missing — defaulted to null') }
  if (!('transport' in result)) { result.transport = null; warnings.push('transport section missing — defaulted to null') }
  if (!('pianoRoll' in result)) { result.pianoRoll = null; warnings.push('pianoRoll section missing — defaulted to null') }
  if (!('midi'      in result)) { result.midi      = null; warnings.push('midi section missing — defaulted to null') }
  if (!('project'   in result)) { result.project   = null; warnings.push('project section missing — defaulted to null') }

  return result
}

// Add more migration functions here as schema evolves:
// function migrateV1toV2(raw: Record<string, unknown>, warnings: string[]): Record<string, unknown> { ... }

const MIGRATIONS: Array<(data: Record<string, unknown>, warnings: string[]) => Record<string, unknown>> = [
  migrateV0toV1,   // index 0 = v0 → v1
  // migrateV1toV2, // index 1 = v1 → v2
]

// ── Public API ─────────────────────────────────────────────────────────────────

// Migrate raw parsed project data to the latest schema version.
// Returns MigrationResult on success or MigrationError if the version is too new.
export function migrateToLatest(raw: unknown): MigrationResult | MigrationError {
  const fromVersion = detectVersion(raw)

  // Future version: we cannot downgrade
  if (fromVersion > LATEST_SCHEMA_VERSION) {
    return {
      error: `Project was saved with a newer version of Neurotek Studio (schema v${fromVersion}). Please update the app to open this project.`,
      fromVersion,
    }
  }

  if (fromVersion === LATEST_SCHEMA_VERSION) {
    // Already current — no migration needed
    return {
      data:        raw,
      fromVersion,
      toVersion:   LATEST_SCHEMA_VERSION,
      didMigrate:  false,
      warnings:    [],
    }
  }

  // Run each migration step from fromVersion to LATEST_SCHEMA_VERSION
  let current = raw as Record<string, unknown>
  const warnings: string[] = []

  for (let v = fromVersion; v < LATEST_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) {
      return {
        error: `No migration path from schema v${v} to v${v + 1}. Project cannot be opened.`,
        fromVersion,
      }
    }
    current = migrate(current, warnings)
  }

  return {
    data:        current,
    fromVersion,
    toVersion:   LATEST_SCHEMA_VERSION,
    didMigrate:  true,
    warnings,
  }
}

// Type guard for MigrationError
export function isMigrationError(r: MigrationResult | MigrationError): r is MigrationError {
  return 'error' in r
}

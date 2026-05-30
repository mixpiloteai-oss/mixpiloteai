// ─── Update Check & Manifest API ─────────────────────────────────────────────
// Provides update metadata, compatibility info, and version changelogs.
// The actual binary delivery is handled by GitHub Releases via electron-updater.
// This API adds: checksum registry, compatibility matrix, changelog delivery.

import { Router, Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { ok, fail, HTTP } from '../utils/response'

const router = Router()

// ── Version registry (production: read from release metadata / DB) ─────────────

interface VersionManifest {
  version:       string
  releasedAt:    string          // ISO date
  minAppVersion: string          // minimum app version that can load projects from this version
  schemaVersion: number          // project schema version
  changelog:     string[]        // bullet points
  checksums: {
    win32_x64?:  string          // SHA-256 of NSIS installer
    darwin_x64?: string
    darwin_arm64?: string
    linux_x64?:  string
  }
  critical:      boolean         // if true, update is mandatory (security fix)
}

const VERSION_REGISTRY: VersionManifest[] = [
  {
    version:       '0.2.0',
    releasedAt:    '2025-01-15T00:00:00Z',
    minAppVersion: '0.1.0',
    schemaVersion: 1,
    changelog: [
      'AudioWorklet scheduler for ultra-low latency playback',
      'Performance modes: quality / balanced / studio / low-config',
      'Canvas frustum culling for large projects',
      'Auto-updater with rollback support',
      'Security: plugin crash isolation, file upload validation',
    ],
    checksums: {
      win32_x64:   '',   // populated by CI at release time
      darwin_x64:  '',
      darwin_arm64:'',
      linux_x64:   '',
    },
    critical: false,
  },
  {
    version:       '0.1.0',
    releasedAt:    '2024-10-01T00:00:00Z',
    minAppVersion: '0.0.1',
    schemaVersion: 1,
    changelog: [
      'Initial release',
      'Basic MIDI sequencer, audio engine, mixer',
    ],
    checksums: {},
    critical: false,
  },
]

// Returns the latest version entry
function getLatest(): VersionManifest {
  return VERSION_REGISTRY[0]
}

// Compare semver strings (major.minor.patch) — returns positive if a > b
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

// ── GET /api/updates/check ─────────────────────────────────────────────────────
// Query params: version (current app version), platform (win32|darwin|linux)
// Returns: hasUpdate, latest version info, checksum for this platform
router.get('/check', asyncHandler(async (req: Request, res: Response) => {
  const currentVersion = typeof req.query.version === 'string' ? req.query.version : '0.0.0'
  const platform       = typeof req.query.platform === 'string' ? req.query.platform : 'unknown'
  const arch           = typeof req.query.arch === 'string' ? req.query.arch : 'x64'

  const latest    = getLatest()
  const hasUpdate = semverGt(latest.version, currentVersion)

  const platformKey = `${platform}_${arch}` as keyof typeof latest.checksums
  const checksum    = latest.checksums[platformKey] ?? null

  res.json(ok({
    hasUpdate,
    current:    currentVersion,
    latest:     latest.version,
    releasedAt: latest.releasedAt,
    critical:   latest.critical,
    changelog:  hasUpdate ? latest.changelog : [],
    checksum,
  }))
}))

// ── GET /api/updates/manifest ──────────────────────────────────────────────────
// Returns full manifest for latest version (checksums, schema version, etc.)
router.get('/manifest', asyncHandler(async (_req: Request, res: Response) => {
  const latest = getLatest()
  res.json(ok(latest))
}))

// ── GET /api/updates/changelog/:version ───────────────────────────────────────
// Returns changelog for a specific version
router.get('/changelog/:version', asyncHandler(async (req: Request, res: Response) => {
  const { version } = req.params
  const entry = VERSION_REGISTRY.find(v => v.version === version)
  if (!entry) {
    res.status(HTTP.NOT_FOUND).json(fail(`No changelog found for version ${version}`))
    return
  }
  res.json(ok({ version: entry.version, releasedAt: entry.releasedAt, changelog: entry.changelog }))
}))

// ── GET /api/updates/history ───────────────────────────────────────────────────
// All versions ordered newest first
router.get('/history', asyncHandler(async (_req: Request, res: Response) => {
  const history = VERSION_REGISTRY.map(v => ({
    version:       v.version,
    releasedAt:    v.releasedAt,
    schemaVersion: v.schemaVersion,
    critical:      v.critical,
  }))
  res.json(ok(history))
}))

// ── GET /api/updates/compatibility ────────────────────────────────────────────
// Query: fromVersion (app version that created the project), toVersion (current app)
// Returns: canOpen, requiresMigration, schemaVersionFrom, schemaVersionTo
router.get('/compatibility', asyncHandler(async (req: Request, res: Response) => {
  const fromVersion = typeof req.query.from === 'string' ? req.query.from : ''
  const toVersion   = typeof req.query.to   === 'string' ? req.query.to   : getLatest().version

  if (!fromVersion) {
    res.status(HTTP.BAD_REQUEST).json(fail('from query param required'))
    return
  }

  const fromEntry = VERSION_REGISTRY.find(v => v.version === fromVersion)
  const toEntry   = VERSION_REGISTRY.find(v => v.version === toVersion)

  if (!fromEntry) {
    // Unknown from-version: assume compatible with warning
    res.json(ok({
      canOpen:          true,
      requiresMigration: false,
      warning:          `Unknown source version ${fromVersion} — compatibility unknown`,
    }))
    return
  }

  // Check if toEntry's minAppVersion is satisfied
  const toManifest  = toEntry ?? getLatest()
  const canOpen     = !semverGt(toManifest.minAppVersion, fromVersion)
  const requiresMigration = fromEntry.schemaVersion !== toManifest.schemaVersion

  res.json(ok({
    canOpen,
    requiresMigration,
    schemaVersionFrom: fromEntry.schemaVersion,
    schemaVersionTo:   toManifest.schemaVersion,
    warning: canOpen ? null : `Projects from v${fromVersion} are not compatible with v${toVersion}`,
  }))
}))

export default router

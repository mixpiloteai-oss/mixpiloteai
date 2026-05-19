// ─── Plugin Blacklist ─────────────────────────────────────────────────────────
// Tracks crash counts per plugin path. Auto-blacklists after MAX_CRASHES.
// Persists to {userData}/plugin-blacklist.json.

import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface BlacklistEntry {
  path:          string
  name:          string
  crashCount:    number
  lastCrashAt:   number
  blacklistedAt: number | null
  reason:        string
}

const MAX_CRASHES = 3

function filePath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'plugin-blacklist.json')
}

function load(): Map<string, BlacklistEntry> {
  const fp = filePath()
  if (!existsSync(fp)) return new Map()
  try {
    const raw = JSON.parse(readFileSync(fp, 'utf8')) as BlacklistEntry[]
    return new Map(raw.map(e => [e.path, e]))
  } catch {
    return new Map()
  }
}

function save(map: Map<string, BlacklistEntry>): void {
  const fp = filePath()
  mkdirSync(join(fp, '..'), { recursive: true })
  writeFileSync(fp, JSON.stringify([...map.values()], null, 2), 'utf8')
}

const db = load()

export function recordCrash(path: string, name: string, reason = 'process crashed'): {
  blacklisted: boolean; crashCount: number
} {
  const existing = db.get(path) ?? {
    path, name, crashCount: 0, lastCrashAt: 0, blacklistedAt: null, reason: '',
  }
  existing.crashCount++
  existing.lastCrashAt = Date.now()
  existing.reason      = reason
  if (existing.crashCount >= MAX_CRASHES && !existing.blacklistedAt) {
    existing.blacklistedAt = Date.now()
  }
  db.set(path, existing)
  save(db)
  return { blacklisted: existing.blacklistedAt !== null, crashCount: existing.crashCount }
}

export function isBlacklisted(path: string): boolean {
  return db.get(path)?.blacklistedAt != null
}

export function removeFromBlacklist(path: string): void {
  const e = db.get(path)
  if (e) {
    e.blacklistedAt = null
    e.crashCount    = 0
    db.set(path, e)
    save(db)
  }
}

export function getAll(): BlacklistEntry[] {
  return [...db.values()]
}

export function getEntry(path: string): BlacklistEntry | null {
  return db.get(path) ?? null
}

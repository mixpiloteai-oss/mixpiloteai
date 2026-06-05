import * as fs from 'fs'
import * as path from 'path'

export type PluginCategory = 'instrument' | 'effect' | 'midi-effect' | 'analyzer' | 'unknown'

export interface ScannedPlugin {
  id: string
  name: string
  vendor: string
  version: string
  category: PluginCategory
  path: string
  hasEditor: boolean
  paramCount: number
  inputBusCount: number
  outputBusCount: number
  supportsMidi: boolean
  supportsMultiOut: boolean
  scanTimestamp: number
  // Enhanced fields (optional for backward compatibility)
  cid?: string
  sdkVersion?: string
  subCategories?: string[]
  binaryPath?: string | null
  binaryExists?: boolean
}

export interface SearchFilters {
  category?: PluginCategory
  tags?: string[]
  favoritesOnly?: boolean
  collectionId?: string
  hasEditor?: boolean
  vendor?: string
}

export interface PluginCollection {
  id: string
  name: string
  pluginIds: string[]
}

interface DatabaseFile {
  plugins: ScannedPlugin[]
  failed: Record<string, string>
  favorites?: string[]
  tags?: Record<string, string[]>
  collections?: PluginCollection[]
}

export class VstDatabase {
  private plugins: Map<string, ScannedPlugin> = new Map()
  private failed: Map<string, string> = new Map()
  private readonly filePath: string

  // Favorites
  private favoritedIds: Set<string> = new Set()

  // Tags
  private pluginTags: Map<string, string[]> = new Map()

  // Collections
  private collections: Map<string, PluginCollection> = new Map()

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath
    } else {
      // Lazy import of electron app to avoid issues in tests
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { app } = require('electron') as { app: { getPath: (name: string) => string } }
      this.filePath = path.join(app.getPath('userData'), 'vst-database.json')
    }
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8')
      const data = JSON.parse(raw) as DatabaseFile
      this.plugins = new Map(data.plugins.map(p => [p.id, p]))
      this.failed = new Map(Object.entries(data.failed ?? {}))
      this.favoritedIds = new Set(data.favorites ?? [])
      this.pluginTags = new Map(Object.entries(data.tags ?? {}))
      this.collections = new Map(
        (data.collections ?? []).map(c => [c.id, c])
      )
    } catch {
      // File doesn't exist yet — start fresh
      this.plugins = new Map()
      this.failed = new Map()
      this.favoritedIds = new Set()
      this.pluginTags = new Map()
      this.collections = new Map()
    }
  }

  async save(): Promise<void> {
    const data: DatabaseFile = {
      plugins: Array.from(this.plugins.values()),
      failed: Object.fromEntries(this.failed.entries()),
      favorites: Array.from(this.favoritedIds),
      tags: Object.fromEntries(this.pluginTags.entries()),
      collections: Array.from(this.collections.values()),
    }
    await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // ── Plugin CRUD ───────────────────────────────────────────────────────────

  addPlugin(p: ScannedPlugin): void {
    this.plugins.set(p.id, p)
  }

  removePlugin(id: string): void {
    this.plugins.delete(id)
    this.favoritedIds.delete(id)
    this.pluginTags.delete(id)
    // Remove from all collections
    for (const coll of this.collections.values()) {
      coll.pluginIds = coll.pluginIds.filter(pid => pid !== id)
    }
  }

  getPlugin(id: string): ScannedPlugin | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): ScannedPlugin[] {
    return Array.from(this.plugins.values())
  }

  getByCategory(cat: PluginCategory): ScannedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.category === cat)
  }

  search(query: string): ScannedPlugin[] {
    const q = query.toLowerCase()
    return Array.from(this.plugins.values()).filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }

  searchAdvanced(query: string, filters: SearchFilters): ScannedPlugin[] {
    const q = query.toLowerCase()

    return Array.from(this.plugins.values()).filter(p => {
      // Text search
      if (q) {
        const tags = this.pluginTags.get(p.id) ?? []
        const matchesText =
          p.name.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          tags.some(t => t.toLowerCase().includes(q))
        if (!matchesText) return false
      }

      // Category filter
      if (filters.category && p.category !== filters.category) return false

      // Vendor filter
      if (filters.vendor && !p.vendor.toLowerCase().includes(filters.vendor.toLowerCase())) return false

      // Has editor filter
      if (filters.hasEditor !== undefined && p.hasEditor !== filters.hasEditor) return false

      // Tags filter (plugin must have ALL specified tags)
      if (filters.tags && filters.tags.length > 0) {
        const pluginTagList = this.pluginTags.get(p.id) ?? []
        const hasAllTags = filters.tags.every(t => pluginTagList.includes(t))
        if (!hasAllTags) return false
      }

      // Favorites filter
      if (filters.favoritesOnly && !this.favoritedIds.has(p.id)) return false

      // Collection filter
      if (filters.collectionId) {
        const coll = this.collections.get(filters.collectionId)
        if (!coll || !coll.pluginIds.includes(p.id)) return false
      }

      return true
    })
  }

  markFailed(id: string, error: string): void {
    this.failed.set(id, error)
  }

  getFailedPlugins(): Map<string, string> {
    return new Map(this.failed)
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  addFavorite(id: string): void {
    this.favoritedIds.add(id)
  }

  removeFavorite(id: string): void {
    this.favoritedIds.delete(id)
  }

  isFavorite(id: string): boolean {
    return this.favoritedIds.has(id)
  }

  getFavorites(): ScannedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => this.favoritedIds.has(p.id))
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  addTag(id: string, tag: string): void {
    const existing = this.pluginTags.get(id) ?? []
    if (!existing.includes(tag)) {
      this.pluginTags.set(id, [...existing, tag])
    }
  }

  removeTag(id: string, tag: string): void {
    const existing = this.pluginTags.get(id) ?? []
    this.pluginTags.set(id, existing.filter(t => t !== tag))
  }

  getTags(id: string): string[] {
    return this.pluginTags.get(id) ?? []
  }

  getByTag(tag: string): ScannedPlugin[] {
    const results: ScannedPlugin[] = []
    for (const [id, tags] of this.pluginTags) {
      if (tags.includes(tag)) {
        const plugin = this.plugins.get(id)
        if (plugin) results.push(plugin)
      }
    }
    return results
  }

  getAllTags(): string[] {
    const all = new Set<string>()
    for (const tags of this.pluginTags.values()) {
      for (const tag of tags) {
        all.add(tag)
      }
    }
    return Array.from(all).sort()
  }

  // ── Collections ───────────────────────────────────────────────────────────

  createCollection(name: string): PluginCollection {
    const id = `coll_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const coll: PluginCollection = { id, name, pluginIds: [] }
    this.collections.set(id, coll)
    return coll
  }

  addToCollection(collId: string, pluginId: string): void {
    const coll = this.collections.get(collId)
    if (!coll) throw new Error(`Collection not found: ${collId}`)
    if (!coll.pluginIds.includes(pluginId)) {
      coll.pluginIds.push(pluginId)
    }
  }

  removeFromCollection(collId: string, pluginId: string): void {
    const coll = this.collections.get(collId)
    if (!coll) throw new Error(`Collection not found: ${collId}`)
    coll.pluginIds = coll.pluginIds.filter(id => id !== pluginId)
  }

  getCollection(collId: string): PluginCollection | undefined {
    return this.collections.get(collId)
  }

  getAllCollections(): PluginCollection[] {
    return Array.from(this.collections.values())
  }

  deleteCollection(collId: string): void {
    this.collections.delete(collId)
  }
}

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
}

interface DatabaseFile {
  plugins: ScannedPlugin[]
  failed: Record<string, string>
}

export class VstDatabase {
  private plugins: Map<string, ScannedPlugin> = new Map()
  private failed: Map<string, string> = new Map()
  private readonly filePath: string

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
    } catch {
      // File doesn't exist yet — start fresh
      this.plugins = new Map()
      this.failed = new Map()
    }
  }

  async save(): Promise<void> {
    const data: DatabaseFile = {
      plugins: Array.from(this.plugins.values()),
      failed: Object.fromEntries(this.failed.entries()),
    }
    await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  addPlugin(p: ScannedPlugin): void {
    this.plugins.set(p.id, p)
  }

  removePlugin(id: string): void {
    this.plugins.delete(id)
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

  markFailed(id: string, error: string): void {
    this.failed.set(id, error)
  }

  getFailedPlugins(): Map<string, string> {
    return new Map(this.failed)
  }
}

/**
 * ActionRegistry — named action catalog.
 * Pure-TS, no DOM/browser dependencies.
 */

export type ActionCategory =
  | 'transport'
  | 'edit'
  | 'navigation'
  | 'view'
  | 'record'
  | 'clip'
  | 'mix'
  | 'tool'

export interface ActionDef {
  id:          string
  label:       string
  category:    ActionCategory
  description: string
  handler():   void
}

export class ActionRegistry {
  private _actions = new Map<string, ActionDef>()

  register(def: ActionDef): void {
    this._actions.set(def.id, def)
  }

  unregister(id: string): void {
    this._actions.delete(id)
  }

  /** Execute action by id. Returns true if found and called, false otherwise. */
  execute(id: string): boolean {
    const def = this._actions.get(id)
    if (!def) return false
    def.handler()
    return true
  }

  getAll(): ActionDef[] {
    return [...this._actions.values()]
  }

  getByCategory(cat: ActionCategory): ActionDef[] {
    return this.getAll().filter((a) => a.category === cat)
  }

  has(id: string): boolean {
    return this._actions.has(id)
  }

  clear(): void {
    this._actions.clear()
  }
}

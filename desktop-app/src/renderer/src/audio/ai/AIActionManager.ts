// ─── AIActionManager.ts ───────────────────────────────────────────────────────
// Non-destructive AI action system with preview + undo.
// All AI-generated changes flow through this manager.

export type AIActionType =
  | 'add-midi-notes'
  | 'replace-midi-notes'
  | 'delete-midi-notes'
  | 'add-automation'
  | 'modify-automation'
  | 'add-clip'
  | 'modify-track-settings'
  | 'reorder-tracks'
  | 'suggest-only'

export type AIActionStatus = 'pending' | 'previewing' | 'applied' | 'rejected' | 'undone'

export interface AIPreviewData {
  midiNotes?: Array<{ pitch: number; startBeat: number; duration: number; velocity: number }>
  automationPoints?: Array<{ laneId: string; beat: number; value: number }>
  textSuggestion?: string
  paramChanges?: Array<{ paramName: string; currentValue: number; suggestedValue: number; unit?: string }>
}

export interface AIAction {
  id: string
  type: AIActionType
  title: string
  description: string
  sourceCommand: string
  targetTrackId?: string
  targetClipId?: string
  previewData: AIPreviewData
  status: AIActionStatus
  createdAt: number
  appliedAt?: number
  confidence: number
}

export class AIActionManager {
  private _actions: AIAction[] = []
  private readonly MAX_HISTORY = 50

  createAction(
    type: AIActionType,
    title: string,
    description: string,
    sourceCommand: string,
    previewData: AIPreviewData,
    confidence: number,
    targetTrackId?: string,
  ): AIAction {
    const action: AIAction = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      description,
      sourceCommand,
      previewData,
      confidence,
      status: 'pending',
      createdAt: Date.now(),
      targetTrackId,
    }

    this._actions.push(action)

    // Trim history if over MAX_HISTORY — remove oldest non-pending/previewing
    if (this._actions.length > this.MAX_HISTORY) {
      const removeIdx = this._actions.findIndex(
        a => a.status === 'applied' || a.status === 'rejected' || a.status === 'undone',
      )
      if (removeIdx !== -1) {
        this._actions.splice(removeIdx, 1)
      }
    }

    return action
  }

  previewAction(id: string): AIAction | undefined {
    const action = this._actions.find(a => a.id === id)
    if (!action) return undefined
    action.status = 'previewing'
    return action
  }

  applyAction(id: string): boolean {
    const action = this._actions.find(a => a.id === id)
    if (!action) return false
    if (action.status !== 'pending' && action.status !== 'previewing') return false
    action.status = 'applied'
    action.appliedAt = Date.now()
    return true
  }

  rejectAction(id: string): void {
    const action = this._actions.find(a => a.id === id)
    if (action) {
      action.status = 'rejected'
    }
  }

  undoAction(id: string): boolean {
    const action = this._actions.find(a => a.id === id)
    if (!action) return false
    if (action.status !== 'applied') return false
    action.status = 'undone'
    return true
  }

  getPendingActions(): AIAction[] {
    return this._actions.filter(
      a => a.status === 'pending' || a.status === 'previewing',
    )
  }

  getHistory(): AIAction[] {
    return this._actions
      .filter(a => a.status === 'applied' || a.status === 'rejected' || a.status === 'undone')
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  getAction(id: string): AIAction | undefined {
    return this._actions.find(a => a.id === id)
  }

  clearHistory(): void {
    this._actions = this._actions.filter(
      a => a.status === 'pending' || a.status === 'previewing',
    )
  }

  get totalApplied(): number {
    return this._actions.filter(a => a.status === 'applied').length
  }

  get totalRejected(): number {
    return this._actions.filter(a => a.status === 'rejected').length
  }

  get acceptanceRate(): number {
    const total = this.totalApplied + this.totalRejected
    if (total === 0) return 0
    return this.totalApplied / total
  }
}

export const aiActionManager = new AIActionManager()

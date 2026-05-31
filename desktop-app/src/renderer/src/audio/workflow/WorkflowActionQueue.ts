// ─── WorkflowActionQueue ─────────────────────────────────────────────────────
// Non-blocking queue for workflow actions with confirm/dismiss semantics.

export type WorkflowActionType =
  | 'set_track_color' | 'set_track_name' | 'set_track_gain'
  | 'set_master_gain' | 'set_track_pan' | 'unsolo_track' | 'unmute_track'

export interface WorkflowAction {
  id:            string
  type:          WorkflowActionType
  description:   string
  trackId?:      string
  payload:       Record<string, unknown>
  previousValue: unknown
  status:        'pending' | 'confirmed' | 'dismissed'
  createdAt:     number
}

export class WorkflowActionQueue {
  private static readonly MAX_PENDING = 10
  private _actions: WorkflowAction[] = []
  private _idCounter = 0

  private generateId(): string {
    this._idCounter++
    return `wfa-${Date.now()}-${this._idCounter}`
  }

  enqueue(action: Omit<WorkflowAction, 'id' | 'status' | 'createdAt'>): WorkflowAction {
    // Drop oldest pending if at limit
    const pending = this._actions.filter(a => a.status === 'pending')
    if (pending.length >= WorkflowActionQueue.MAX_PENDING) {
      const oldest = pending[0]
      if (oldest) {
        const idx = this._actions.findIndex(a => a.id === oldest.id)
        if (idx !== -1) {
          this._actions.splice(idx, 1)
        }
      }
    }

    const newAction: WorkflowAction = {
      ...action,
      id:        this.generateId(),
      status:    'pending',
      createdAt: Date.now(),
    }
    this._actions.push(newAction)
    return newAction
  }

  confirm(id: string): WorkflowAction | null {
    const action = this._actions.find(a => a.id === id)
    if (!action || action.status !== 'pending') return null
    action.status = 'confirmed'
    return action
  }

  dismiss(id: string): void {
    const action = this._actions.find(a => a.id === id)
    if (action && action.status === 'pending') {
      action.status = 'dismissed'
    }
  }

  getPending(): WorkflowAction[] {
    return this._actions.filter(a => a.status === 'pending')
  }

  getAll(): WorkflowAction[] {
    return [...this._actions]
  }

  clear(): void {
    this._actions = []
  }

  size(): number {
    return this._actions.filter(a => a.status === 'pending').length
  }
}

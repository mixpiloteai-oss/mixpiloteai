import type { SerializedFxChain, FxSlotSnapshot } from './vstTypes'

// ── FX Chain ───────────────────────────────────────────────────────────────────
// Manages an ordered chain of effect plugin slots for a track.
// NOTE: FxChain itself does NOT call vstClient (keep it pure/testable).
// The store layer calls vstClient then creates the FxChain slot with the returned instanceId.

export interface FxSlot {
  slotId: string
  instanceId: string
  pluginId: string
  pluginName: string
  bypassed: boolean
  gainDb: number
}

let slotCounter = 0

export class FxChain {
  private readonly trackId: string
  private slots: FxSlot[] = []

  constructor(trackId: string) {
    this.trackId = trackId
  }

  addEffect(pluginId: string, pluginName: string): FxSlot {
    const slotId = `slot_${this.trackId}_${++slotCounter}_${Date.now()}`
    const slot: FxSlot = {
      slotId,
      instanceId: '',  // Caller sets instanceId after loading via vstClient
      pluginId,
      pluginName,
      bypassed: false,
      gainDb: 0,
    }
    this.slots.push(slot)
    return slot
  }

  removeEffect(slotId: string): void {
    this.slots = this.slots.filter(s => s.slotId !== slotId)
  }

  moveEffect(slotId: string, newIndex: number): void {
    const idx = this.slots.findIndex(s => s.slotId === slotId)
    if (idx === -1) return
    const [slot] = this.slots.splice(idx, 1)
    const clamped = Math.max(0, Math.min(newIndex, this.slots.length))
    this.slots.splice(clamped, 0, slot)
  }

  setSlotBypassed(slotId: string, bypassed: boolean): void {
    const slot = this.slots.find(s => s.slotId === slotId)
    if (slot) slot.bypassed = bypassed
  }

  setSlotGain(slotId: string, gainDb: number): void {
    const slot = this.slots.find(s => s.slotId === slotId)
    if (slot) slot.gainDb = gainDb
  }

  getSlots(): readonly FxSlot[] {
    return this.slots
  }

  getSlot(slotId: string): FxSlot | undefined {
    return this.slots.find(s => s.slotId === slotId)
  }

  serializeState(): SerializedFxChain {
    return {
      trackId: this.trackId,
      slots: this.slots.map((s): FxSlotSnapshot => ({
        slotId: s.slotId,
        pluginId: s.pluginId,
        bypassed: s.bypassed,
        gainDb: s.gainDb,
        instanceState: null,
      })),
    }
  }

  restoreState(data: SerializedFxChain): void {
    this.slots = data.slots.map((snap): FxSlot => ({
      slotId: snap.slotId,
      instanceId: '',
      pluginId: snap.pluginId,
      pluginName: snap.pluginId,  // Name not stored in snapshot, use pluginId as fallback
      bypassed: snap.bypassed,
      gainDb: snap.gainDb,
    }))
  }
}

export function createFxChain(trackId: string): FxChain {
  return new FxChain(trackId)
}

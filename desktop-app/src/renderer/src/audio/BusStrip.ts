// ─── BusStrip.ts ──────────────────────────────────────────────────────────────
// Browser-only: requires Web Audio API.
// A bus/subgroup strip: receives sends from multiple tracks, applies gain+pan.

import { ChannelStrip } from './ChannelStrip.ts'

export class BusStrip extends ChannelStrip {
  readonly inputMix:       GainNode
  private _members:        Set<string> = new Set()

  constructor(id: string, ctx: AudioContext, destination: AudioNode) {
    super(id, ctx, destination)
    this.inputMix = ctx.createGain()
    this.inputMix.connect(this.input)
  }

  addMember(trackId: string): void {
    this._members.add(trackId)
  }

  removeMember(trackId: string): void {
    this._members.delete(trackId)
  }

  get memberIds(): ReadonlySet<string> {
    return this._members
  }

  override dispose(): void {
    this.inputMix.disconnect()
    super.dispose()
  }
}

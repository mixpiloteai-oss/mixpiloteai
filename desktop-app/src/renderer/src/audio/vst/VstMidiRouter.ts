import type { MidiRoute, MidiEvent } from './vstTypes'

// ── VST MIDI Router ────────────────────────────────────────────────────────────
// Routes MIDI events from source tracks to plugin instances with transformations.

let routeCounter = 0

export class VstMidiRouter {
  private routes: Map<string, MidiRoute> = new Map()

  addRoute(route: Omit<MidiRoute, 'routeId'>): MidiRoute {
    const routeId = `midi_route_${++routeCounter}_${Date.now()}`
    const fullRoute: MidiRoute = { routeId, ...route }
    this.routes.set(routeId, fullRoute)
    return fullRoute
  }

  removeRoute(routeId: string): void {
    this.routes.delete(routeId)
  }

  getRoutesForTrack(trackId: string): MidiRoute[] {
    return Array.from(this.routes.values()).filter(r => r.sourceTrackId === trackId)
  }

  routeEvent(sourceTrackId: string, event: MidiEvent): Array<{ instanceId: string; event: MidiEvent }> {
    const results: Array<{ instanceId: string; event: MidiEvent }> = []

    for (const route of this.routes.values()) {
      if (route.sourceTrackId !== sourceTrackId) continue

      // Channel filter
      if (route.channelFilter !== 'all' && event.channel !== route.channelFilter) continue

      // Build transformed event
      const transformed: MidiEvent = { ...event }

      // Apply note transpose (clamp 0-127)
      if (transformed.note !== undefined) {
        transformed.note = Math.max(0, Math.min(127, transformed.note + route.noteTranspose))
      }

      // Apply velocity scale (clamp 0-127)
      if (transformed.velocity !== undefined) {
        transformed.velocity = Math.max(0, Math.min(127, Math.round(transformed.velocity * route.velocityScale)))
      }

      results.push({ instanceId: route.targetInstanceId, event: transformed })
    }

    return results
  }

  clearTrackRoutes(trackId: string): void {
    for (const [routeId, route] of this.routes) {
      if (route.sourceTrackId === trackId) {
        this.routes.delete(routeId)
      }
    }
  }
}

export const vstMidiRouter = new VstMidiRouter()
export type { VstMidiRouter }

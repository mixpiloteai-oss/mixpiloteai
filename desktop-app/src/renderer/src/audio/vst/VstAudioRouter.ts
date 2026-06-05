import type { AudioRoute } from './vstTypes'

// ── VST Audio Router ───────────────────────────────────────────────────────────
// Manages audio routing graph between plugin instances and the mixer.
// Supports cycle detection and topological ordering for correct signal flow.

let routeCounter = 0

export class VstAudioRouter {
  private routes: Map<string, AudioRoute> = new Map()

  addRoute(route: Omit<AudioRoute, 'routeId'>): AudioRoute {
    const routeId = `audio_route_${++routeCounter}_${Date.now()}`
    const fullRoute: AudioRoute = { routeId, ...route }
    this.routes.set(routeId, fullRoute)
    return fullRoute
  }

  removeRoute(routeId: string): void {
    this.routes.delete(routeId)
  }

  getRoutingGraph(): { instanceIds: string[]; routes: AudioRoute[] } {
    const routeArr = Array.from(this.routes.values())
    const instanceSet = new Set<string>()
    for (const r of routeArr) {
      instanceSet.add(r.fromInstanceId)
      if (r.toInstanceId !== 'mixer') {
        instanceSet.add(r.toInstanceId)
      }
    }
    return {
      instanceIds: Array.from(instanceSet),
      routes: routeArr,
    }
  }

  detectCycles(): boolean {
    // DFS cycle detection on the directed graph (skip 'mixer' as a terminal)
    const routes = Array.from(this.routes.values())

    // Build adjacency list (exclude 'mixer' as destination)
    const adj = new Map<string, string[]>()
    for (const r of routes) {
      if (r.toInstanceId === 'mixer') continue
      if (!adj.has(r.fromInstanceId)) adj.set(r.fromInstanceId, [])
      adj.get(r.fromInstanceId)!.push(r.toInstanceId)
    }

    const visited = new Set<string>()
    const inStack = new Set<string>()

    const dfs = (node: string): boolean => {
      visited.add(node)
      inStack.add(node)

      for (const neighbor of (adj.get(node) ?? [])) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true
        } else if (inStack.has(neighbor)) {
          return true
        }
      }

      inStack.delete(node)
      return false
    }

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true
      }
    }

    return false
  }

  getOutputOrder(): string[] {
    // Kahn's algorithm topological sort — only instances that appear as fromInstanceId
    const routes = Array.from(this.routes.values())

    const adj = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const allNodes = new Set<string>()

    for (const r of routes) {
      if (r.toInstanceId === 'mixer') continue
      allNodes.add(r.fromInstanceId)
      allNodes.add(r.toInstanceId)
      if (!adj.has(r.fromInstanceId)) adj.set(r.fromInstanceId, [])
      adj.get(r.fromInstanceId)!.push(r.toInstanceId)
    }

    // Also include nodes that only appear as fromInstanceId (going to mixer)
    for (const r of routes) {
      if (!allNodes.has(r.fromInstanceId)) allNodes.add(r.fromInstanceId)
    }

    for (const node of allNodes) {
      if (!inDegree.has(node)) inDegree.set(node, 0)
    }

    for (const [, neighbors] of adj) {
      for (const n of neighbors) {
        inDegree.set(n, (inDegree.get(n) ?? 0) + 1)
      }
    }

    const queue: string[] = []
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)
      for (const neighbor of (adj.get(node) ?? [])) {
        const newDeg = (inDegree.get(neighbor) ?? 0) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) queue.push(neighbor)
      }
    }

    return result
  }
}

export const vstAudioRouter = new VstAudioRouter()

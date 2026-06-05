// ─── SidechainRouter.ts ───────────────────────────────────────────────────────
// Manages sidechain source registrations and cross-track audio connections.
// ConnectableNode is a subset of AudioNode, kept minimal for testability.

export interface ConnectableNode {
  connect(destination: ConnectableNode): void
  disconnect(destination?: ConnectableNode): void
}

export class SidechainRouter {
  private _sources:    Map<string, ConnectableNode>                           = new Map()
  private _active:     Map<string, { src: ConnectableNode; dst: ConnectableNode }> = new Map()
  private _connections: Map<string, string>                                   = new Map() // targetId → sourceId

  registerSource(trackId: string, node: ConnectableNode): void {
    this._sources.set(trackId, node)
  }

  unregisterSource(trackId: string): void {
    for (const [targetId, sourceId] of this._connections) {
      if (sourceId === trackId) this.disconnectSidechain(targetId)
    }
    this._sources.delete(trackId)
  }

  connectSidechain(targetTrackId: string, sourceTrackId: string): void {
    this.disconnectSidechain(targetTrackId)
    const src = this._sources.get(sourceTrackId)
    const dst = this._sources.get(targetTrackId)
    if (src && dst) {
      src.connect(dst)
      this._active.set(targetTrackId, { src, dst })
    }
    this._connections.set(targetTrackId, sourceTrackId)
  }

  disconnectSidechain(targetTrackId: string): void {
    const conn = this._active.get(targetTrackId)
    if (conn) {
      conn.src.disconnect(conn.dst)
      this._active.delete(targetTrackId)
    }
    this._connections.delete(targetTrackId)
  }

  getSidechainSourceId(targetTrackId: string): string | null {
    return this._connections.get(targetTrackId) ?? null
  }

  getSidechainNode(targetTrackId: string): ConnectableNode | null {
    const sourceId = this._connections.get(targetTrackId)
    return sourceId ? (this._sources.get(sourceId) ?? null) : null
  }

  hasRegisteredSource(trackId: string): boolean {
    return this._sources.has(trackId)
  }

  dispose(): void {
    for (const targetId of [...this._connections.keys()]) this.disconnectSidechain(targetId)
    this._sources.clear()
  }
}

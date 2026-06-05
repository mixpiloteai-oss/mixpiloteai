# Real-Time Collaboration System Report

## Protocol Choice: Server-Sent Events (SSE)

SSE was chosen over WebSockets for the following reasons:

- **Unidirectional server push** is sufficient: ops flow server→client; clients POST ops via REST.
- **HTTP/1.1 compatible**: no upgrade handshake, works through standard proxies and CDNs.
- **Automatic reconnect**: EventSource reconnects natively; no client-side reconnect loop needed (though we add exponential backoff for control).
- **Simpler auth**: token passed as `?token=` query param since EventSource cannot set headers.
- **Heartbeat via comments**: `: keepalive` comments every 25s prevent proxy timeouts.

Trade-off: SSE cannot receive data from the client. Client writes go through `POST /api/collab/ops`.

---

## OT Algorithm

Operational Transformation (OT) is applied server-side before committing ops:

### Conflict Types and Resolution

| Incoming | Concurrent | Resolution |
|----------|-----------|------------|
| `param-change` | `param-change` (same target+param) | Last-Write-Wins by timestamp |
| `clip-move` | `clip-delete` (same clipId) | Drop clip-move (clip no longer exists) |
| `clip-delete` | `clip-move` | Commit delete (authoritative) |
| `cursor-move` | anything | Always apply (ephemeral, no conflict) |
| all others | anything | Append, no conflict |

### Revision Model

- Each room has a monotonically increasing `rev` counter.
- Clients send their known `rev` (client revision) with each op.
- Ops committed after `incoming.rev` are "concurrent" and OT is applied.
- Committed rev is assigned by the server (source of truth).

---

## Transport Layer

```
Client                       Server
  |                             |
  |  POST /api/collab/ops       |
  |  { type, payload, rev }     |
  |─────────────────────────────>
  |                             |
  |                    [OT transform]
  |                    [assign committedRev]
  |                    [persist to collab_ops]
  |                    [broadcast SSE]
  |                             |
  |  SSE: event: op             |
  |  data: { committedRev, ... }<─────────────
  |                             |
```

Write path latency target: <10ms (in-memory OT + fire-and-forget DB write).

---

## Heartbeat

- Server sends `: keepalive\n\n` every 25 seconds on each SSE connection.
- Client-side: CollaborationClient sends a `cursor-move` heartbeat every 30s.
- If the SSE connection drops, `onerror` triggers reconnect with exponential backoff.

---

## Reconnect Strategy

```
delay = base * (0.8 + random * 0.4)   // ±20% jitter
base doubles on each failure: 3s → 6s → 12s → ... → 60s (cap)
```

On reconnect, client sends `?sinceRev=<lastKnownRev>` to get only missed ops (delta sync).

`lastKnownRev` is persisted in `localStorage` as `collab-rev-{projectId}` so it survives page reload.

---

## Security Model

- **Auth gate**: `requireAuthSSE` middleware validates JWT on every SSE and REST request.
- **Plan gate**: `requirePlan('studio')` limits collab features to paid plans.
- **Project ownership check**: Users can only join rooms for projects they own or have team access to.
- **Payload size limit**: Op payloads are rejected if >10KB.
- **Rate limiting**: 120 ops/minute per user via `express-rate-limit`.
- **Input validation**: `type`, `userName`, `userColor`, `rev` all validated.
- **RLS**: All collab DB tables have Row Level Security enabled (service role only).

---

## Room Lifecycle

```
Project request
    │
    ▼
getOrCreateRoom (sync, in-memory check)
    │  ← fast path: room exists in memory
    │
    ▼
initRoom (async, full DB recovery)
    │  1. Check in-memory map (fast path)
    │  2. Check collab_rooms in DB (restart recovery)
    │  3. If found: recoverRoom() — load snapshot + ops + presence
    │  4. If not: create fresh room + upsert to DB
    │
    ▼
Room live
    │  ← connections, ops, presence all in memory
    │
    ▼ (no connections for 30 min)
scheduleEviction()
    │  1. Delete from rooms Map
    │  2. Delete collab_rooms record
    │  3. Delete collab_ops (fire-and-forget)
    │  4. Delete collab_snapshots (fire-and-forget)
```

---

## Snapshot Strategy

- Snapshot taken every **100 ops** (configurable via `SNAPSHOT_INTERVAL_OPS`).
- Snapshot stores: current rev, recent ops slice, denormalized state.
- On recovery: load latest snapshot, then replay only ops since snapshot rev.
- Only last **3 snapshots** per room retained in DB.
- In-memory snapshot cache (`memSnapshots`) avoids DB reads on hot path.

---

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|---------------|
| Op commit latency | <10ms p99 | In-memory OT, fire-and-forget DB writes |
| Broadcast latency | <5ms | Direct SSE write, no serialization queue |
| Room recovery time | <200ms | Snapshot + bounded op replay |
| Reconnect delta | <100ms | sinceRev query param, indexed ops table |
| Max connections/room | 50 | `MAX_CONNECTIONS_PER_ROOM` enforced at connect |
| Max ops in memory | 500 | `MAX_OPS` rolling window |
| Dedup cache size | 50,000 | Bounded Set + DB ground truth |

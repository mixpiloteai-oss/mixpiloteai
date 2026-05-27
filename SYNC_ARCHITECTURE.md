# Sync Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (browser / desktop)                         │
│                                                                             │
│  ┌──────────────────┐    POST /api/collab/ops    ┌──────────────────────┐  │
│  │ CollabStore       │ ─────────────────────────> │ CollaborationClient  │  │
│  │ (Zustand)         │                            │ (SSE + REST)         │  │
│  │                   │ <─────────────────────────  │                      │  │
│  │  ops[], rev,      │   SSE: event: op           │  lastKnownRev        │  │
│  │  presence[]       │   SSE: event: presence     │  localStorage persist │  │
│  └──────────────────┘   SSE: event: connected    └──────────────────────┘  │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                        HTTP + SSE (TLS)
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                          SERVER (Express)                                   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    collaboration.ts (routes)                        │    │
│  │  GET /stream/:projectId  POST /ops  GET /history  GET /snapshot    │    │
│  └────────────────────────────────┬───────────────────────────────────┘    │
│                                   │                                         │
│  ┌────────────────────────────────▼───────────────────────────────────┐    │
│  │                  collaborationService.ts                             │    │
│  │                                                                      │    │
│  │  rooms: Map<roomId, CollabRoom>    ◄── fast in-memory state         │    │
│  │  projectRoomMap: Map<projectId, roomId>                              │    │
│  │                                                                      │    │
│  │  initRoom()    ── async, recovers from DB on restart                │    │
│  │  submitOp()    ── OT transform → assign rev → persist → broadcast   │    │
│  │  updatePresence() ── debounced, persists to DB                      │    │
│  └──────────────┬──────────────────────┬───────────────────────────────┘    │
│                 │                      │                                     │
│  ┌──────────────▼──────┐  ┌───────────▼──────────────────────────────┐    │
│  │  snapshotService.ts │  │  repositories/                            │    │
│  │                     │  │    collabOpsRepository.ts   (ops log)     │    │
│  │  create() every 100 │  │    presenceRepository.ts    (cursors)     │    │
│  │  loadLatest()       │  │    collabRepository.ts      (rooms meta)  │    │
│  │  deleteByRoom()     │  │    syncDedupRepository.ts   (dedup)       │    │
│  └──────────────┬──────┘  └───────────┬──────────────────────────────┘    │
│                 │                      │                                     │
└─────────────────┼──────────────────────┼────────────────────────────────────┘
                  │                      │
┌─────────────────▼──────────────────────▼────────────────────────────────────┐
│                        Supabase / PostgreSQL                                │
│                                                                             │
│  collab_rooms      (room metadata: id, project_id, rev, last_active)       │
│  collab_ops        (append-only op log: room_id, rev, op_type, payload)    │
│  collab_snapshots  (state snapshots: room_id, rev, state JSONB)            │
│  collab_presence   (cursor state: room_id, user_id, cursor_bar/track)      │
│  sync_dedup        (processed op IDs for idempotency)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Op Commit Flow

```
Client POSTs op { type, payload, rev, timestamp }
    │
    ▼
[validation] -- type, payload size, user auth, plan check
    │
    ▼
getOrCreateRoom(projectId) or initRoom(projectId)
    │
    ▼
otTransform(room, op)
    │
    ├── concurrent ops? (committedRev > incoming.rev)
    │       │
    │       ├── param-change vs param-change: LWW by timestamp
    │       ├── clip-move vs clip-delete: drop clip-move
    │       └── others: pass through
    │
    ▼
assign committedRev = room.rev + 1
    │
    ▼
room.ops.push(committed)           ── in-memory (fast)
room.rev = committedRev
    │
    ├─► collabRepository.touchRoom()    ── fire-and-forget
    ├─► collabOpsRepository.append()    ── fire-and-forget
    └─► snapshotService.create()        ── fire-and-forget (every 100 ops)
    │
    ▼
broadcastToRoom(SSE)               ── synchronous, <1ms
    │
    ▼
return committedOp to HTTP caller
```

---

## Recovery Flow (Server Restart)

```
New request arrives for projectId
    │
    ▼
initRoom(projectId)
    │
    ├── in-memory? → return immediately (fast path)
    │
    └── NOT in memory:
            │
            ▼
        collabRepository.findRoomByProject(projectId)
            │
            ├── NOT in DB → getOrCreateRoom() (fresh room)
            │
            └── FOUND in DB:
                    │
                    ▼
                Build room skeleton (empty ops, rev from DB)
                    │
                    ▼
                recoverRoom(room):
                    │
                    ├── snapshotService.loadLatest(roomId)
                    │       → returns { rev, ops[], state }
                    │
                    ├── collabOpsRepository.loadSinceRev(roomId, snapshotRev)
                    │       → returns ops after snapshot
                    │
                    ├── merge: snapshot.ops + newer ops, dedup by committedRev
                    │
                    ├── room.rev = max(committedRev)
                    │
                    └── presenceRepository.loadByRoom(roomId)
                            → restore active users (last 5 min)
```

---

## Delta Sync (Client Reconnect)

```
Client disconnects (network drop, page reload, etc.)
    │
    └── lastKnownRev saved to localStorage as "collab-rev-{projectId}"

Client reconnects:
    │
    ▼
CollaborationClient.connect(projectId)
    │
    └── reads localStorage("collab-rev-{projectId}") → sinceRev
    │
    ▼
GET /api/collab/stream/{projectId}?sinceRev={lastKnownRev}
    │
    ▼
Server: addConnection() → sends "connected" event
    │
    └── recentOps = getRoomHistory(roomId, sinceRev)
            → only ops with committedRev > sinceRev
            → client gets exactly what it missed, no duplicates
```

---

## Offline Queue

```
Client goes offline
    │
    └── ops queued in CollabStore.pendingOps[]
    └── pendingOps persisted to sessionStorage

Client comes back online
    │
    └── SSE reconnects → "connected" event received
    │
    ▼
_retryPendingOps()
    │
    └── for each pending op: POST /api/collab/ops
    └── OT on server handles concurrent conflicts
    └── on success: removePendingOp(), update sessionStorage
```

---

## Deduplication

```
POST /api/sync { operations: [{ id, type, method, url, payload }] }
    │
    for each op:
        │
        ├── syncDedupRepository.hasSeen(op.id)
        │       ├── memCache.has(id) → true (fast path, no DB)
        │       └── supabase.from('sync_dedup').select WHERE op_id = id
        │
        ├── if seen: return { deduplicated: true }
        │
        └── if not seen:
                │
                ├── dispatch(op) → execute the actual operation
                │
                └── syncDedupRepository.markSeen(op.id)
                        ├── memCache.add(id)
                        └── supabase.from('sync_dedup').upsert({ op_id: id })
```

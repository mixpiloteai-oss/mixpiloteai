# Recovery Flow

## Scenario 1: Server Restart

### Before Restart (State)
- Room `r-abc` exists for project `p-123`
- 250 ops committed (rev = 250)
- 1 snapshot at rev = 200 (stored in `collab_snapshots`)
- Ops 201-250 in `collab_ops` table
- 3 active presences in `collab_presence`

### After Restart

```
Step 1: Server starts fresh
    rooms = Map {}   (empty)
    projectRoomMap = {}   (empty)

Step 2: Client reconnects to GET /api/collab/stream/p-123?sinceRev=248
    │
    ▼
Step 3: initRoom("p-123") called
    │
    ├── rooms.get(projectRoomMap.get("p-123"))
    │       → undefined (maps are empty after restart)
    │
    ├── collabRepository.findRoomByProject("p-123")
    │       → { id: "r-abc", rev: 250 }   (from collab_rooms DB table)
    │
    ├── Build room skeleton:
    │       { id: "r-abc", projectId: "p-123", ops: [], rev: 250,
    │         presence: Map{}, connections: Map{} }
    │
    ├── rooms.set("r-abc", room)
    │   projectRoomMap.set("p-123", "r-abc")
    │
    └── recoverRoom(room):

Step 4: recoverRoom()
    │
    ├── snapshotService.loadLatest("r-abc")
    │       → { rev: 200, ops: [op_151..op_200], state: {}, opsCount: 200 }
    │
    ├── collabOpsRepository.loadSinceRev("r-abc", sinceRev=200)
    │       → [op_201, op_202, ..., op_250]   (50 ops from DB)
    │
    ├── allOps = [...snapshot.ops, ...persistedOps]
    │         = [op_151..op_200, op_201..op_250]
    │
    ├── Deduplicate by committedRev → sorted [op_151..op_250]
    │
    ├── room.ops = [op_151..op_250]  (100 ops in memory)
    │   room.rev = 250
    │
    └── presenceRepository.loadByRoom("r-abc")
            → [user_A, user_B, user_C]   (last 5 min)
            room.presence = Map{ user_A, user_B, user_C }

Step 5: Room recovered. Log:
    [collab] recovered room r-abc (rev=250, ops=100, presence=3)

Step 6: addConnection() called for reconnecting client
    │
    └── sends "connected" event:
            { type: "connected", roomId: "r-abc", rev: 250,
              recentOps: getRoomHistory("r-abc", sinceRev=248) }
              → [op_249, op_250]   (only missed ops)
```

---

## Scenario 2: Client Reconnect with sinceRev

### State
- Room running in memory at rev = 75
- Client was at rev = 60 before disconnect

```
Step 1: Client EventSource onerror fires
    → reconnectDelay doubles (3s → 6s)
    → schedules reconnect in ~5.5s (with jitter)

Step 2: reconnect fires
    connect("p-123", token)
    │
    ├── reads localStorage("collab-rev-p-123") → "60"
    └── lastKnownRev = 60

Step 3: GET /api/collab/stream/p-123?token=...&sinceRev=60&userId=u-1&...

Step 4: Server: initRoom("p-123")
    → room already in memory (r-abc, rev=75)
    → returns immediately (fast path)

Step 5: addConnection(room.id, userId, presence, send)
    │
    └── send({ type: "connected", roomId: "r-abc", rev: 75,
               recentOps: getRoomHistory("r-abc", 60) })
               → [op_61, op_62, ..., op_75]   (15 ops)

Step 6: Client receives "connected"
    │
    ├── store.setRoomRev(75)
    ├── localStorage.setItem("collab-rev-p-123", "75")
    ├── lastKnownRev = 75
    │
    └── for each recentOp: store.applyOp(op)
            → state catches up from rev 60 to 75

Step 7: _retryPendingOps()
    → any ops queued while offline are re-submitted
    → OT on server handles conflicts
```

---

## Scenario 3: Snapshot Restore (100+ ops accumulated)

```
Ops 1-100 committed in room "r-xyz"

At op 100:
    room.ops.length % 100 === 0  → true

snapshotService.create("r-xyz", projectId, rev=100, room.ops):
    │
    ├── snap = { rev: 100, ops: [...last 100 ops], opsCount: 100 }
    ├── memSnapshots.set("r-xyz", snap)
    │
    └── supabase.from("collab_snapshots").insert({
              room_id: "r-xyz", rev: 100,
              state: { ops: [...] }, ops_count: 100
          })

Ops 101-150 committed (no snapshot yet)

Server restarts at op 150.

Recovery:
    │
    ├── snapshotService.loadLatest("r-xyz")
    │       → snap at rev=100 (from DB, memSnapshots empty after restart)
    │
    ├── collabOpsRepository.loadSinceRev("r-xyz", sinceRev=100)
    │       → [op_101..op_150]   (50 ops)
    │
    └── room recovered at rev=150 with 100 ops in memory
            (no need to replay all 150 ops individually)
```

---

## Scenario 4: Presence Recovery

```
User A connected to room "r-abc"
    → room.presence.set("user-A", { cursor: { bar: 32, track: "drums" } })
    → presenceRepository.upsert("r-abc", presenceA)
            → DB: collab_presence(room_id="r-abc", user_id="user-A", 
                                   cursor_bar=32, cursor_track="drums",
                                   last_seen=now)

Server restarts.

User B connects to GET /api/collab/stream/r-abc

recoverRoom():
    │
    └── presenceRepository.loadByRoom("r-abc")
            → supabase: WHERE room_id="r-abc" AND last_seen > (now - 5min)
            → [{ userId: "user-A", cursor: { bar: 32, track: "drums" }, ... }]

room.presence.set("user-A", presence)

→ User B receives presence broadcast showing User A at Bar 32
→ User A reconnects shortly after and becomes fully online
```

---

## Scenario 5: Offline Replay (sync dedup)

```
Client goes offline with 3 queued operations (IDs: op-1, op-2, op-3)

Client reconnects, _retryPendingOps() submits all 3:
    POST /api/sync { operations: [op-1, op-2, op-3] }
    → op-1 processed, syncDedupRepository.markSeen("op-1")
    → op-2 processed, syncDedupRepository.markSeen("op-2")
    → op-3 processed, syncDedupRepository.markSeen("op-3")
    → all 3 in DB: sync_dedup table

Network hiccup — client doesn't receive response, retries:
    POST /api/sync { operations: [op-1, op-2, op-3] }
    → syncDedupRepository.hasSeen("op-1") → true (memCache hit)
    → returns { deduplicated: true } for all 3
    → no double-processing

Server restarts between first and second call:
    → memCache cleared
    → syncDedupRepository.hasSeen("op-1")
            → memCache.has("op-1") → false
            → supabase: WHERE op_id="op-1" → FOUND
            → addToCache("op-1"), return true
    → still deduplicated correctly
```

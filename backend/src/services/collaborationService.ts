// ============================================================
// NEUROTEK AI Backend — Collaboration Service
// Real-time collaboration engine using SSE + OT
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { collabRepository } from '../repositories/collabRepository';

// ── Types ─────────────────────────────────────────────────────

export type CollabOpType =
  | 'param-change'
  | 'clip-move'
  | 'clip-add'
  | 'clip-delete'
  | 'track-add'
  | 'track-delete'
  | 'comment-add'
  | 'comment-resolve'
  | 'chat-message'
  | 'cursor-move';

export interface CollabOp {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  type: CollabOpType;
  payload: Record<string, unknown>;
  rev: number;
  timestamp: number;
}

export interface CommittedOp extends CollabOp {
  committedRev: number;
}

export interface RoomPresence {
  userId: string;
  userName: string;
  userColor: string;
  cursor?: { bar: number; track: string };
  lastSeen: number;
}

export interface CollabRoom {
  id: string;
  projectId: string;
  ops: CommittedOp[];
  rev: number;
  presence: Map<string, RoomPresence>;
  connections: Map<string, (event: CollabEvent) => void>;
}

export type CollabEvent =
  | { type: 'op'; op: CommittedOp }
  | { type: 'presence'; presence: RoomPresence[] }
  | { type: 'connected'; roomId: string; rev: number; recentOps: CommittedOp[] }
  | { type: 'error'; message: string };

// ── Internal state ────────────────────────────────────────────

const rooms = new Map<string, CollabRoom>();
// projectId → roomId mapping
const projectRoomMap = new Map<string, string>();
// eviction timers: roomId → timer
const evictionTimers = new Map<string, ReturnType<typeof setTimeout>>();

const MAX_OPS = 500;
const EVICT_DELAY_MS = 30 * 60 * 1000; // 30 minutes
const RECENT_OPS_ON_CONNECT = 50;
export const MAX_CONNECTIONS_PER_ROOM = 50;

// ── Helpers ───────────────────────────────────────────────────

function broadcastToRoom(room: CollabRoom, event: CollabEvent, excludeUserId?: string): void {
  for (const [uid, send] of room.connections) {
    if (uid !== excludeUserId) {
      try {
        send(event);
      } catch {
        // connection may have closed; cleanup is handled separately
      }
    }
  }
}

function getPresenceList(room: CollabRoom): RoomPresence[] {
  return Array.from(room.presence.values());
}

function scheduleEviction(roomId: string): void {
  cancelEviction(roomId);
  const timer = setTimeout(() => {
    const room = rooms.get(roomId);
    if (room && room.connections.size === 0) {
      rooms.delete(roomId);
      projectRoomMap.delete(room.projectId);
      evictionTimers.delete(roomId);
      // Remove room record from DB
      collabRepository.deleteRoom(roomId).catch(() => {});
    }
  }, EVICT_DELAY_MS).unref(); // unref so test process can exit cleanly
  evictionTimers.set(roomId, timer);
}

function cancelEviction(roomId: string): void {
  const existing = evictionTimers.get(roomId);
  if (existing !== undefined) {
    clearTimeout(existing);
    evictionTimers.delete(roomId);
  }
}

// ── OT Transform ─────────────────────────────────────────────

/**
 * Checks whether `incoming` conflicts with any committed op that was applied
 * after the incoming op's known revision (concurrent ops).
 * Returns the (possibly transformed) op, or null if it should be dropped.
 */
function otTransform(room: CollabRoom, incoming: CollabOp): CollabOp | null {
  // Ops committed after incoming.rev are concurrent
  const concurrentOps = room.ops.filter(o => o.committedRev > incoming.rev);

  let current: CollabOp = { ...incoming };

  for (const committed of concurrentOps) {
    const result = transformAgainst(current, committed);
    if (result === null) return null; // drop
    current = result;
  }

  return current;
}

function transformAgainst(incoming: CollabOp, committed: CommittedOp): CollabOp | null {
  // cursor-move: always apply, no conflict
  if (incoming.type === 'cursor-move') {
    return incoming;
  }

  // param-change vs param-change on same target+param → Last-Write-Wins by timestamp
  if (
    incoming.type === 'param-change' &&
    committed.type === 'param-change'
  ) {
    const iTarget = incoming.payload['target'];
    const iParam = incoming.payload['param'];
    const cTarget = committed.payload['target'];
    const cParam = committed.payload['param'];

    if (iTarget === cTarget && iParam === cParam) {
      // If the committed op has a newer timestamp, the incoming op loses
      if (committed.timestamp >= incoming.timestamp) {
        return null; // drop incoming, committed wins
      }
      // else incoming is newer, let it through
    }
    return incoming;
  }

  // clip-delete concurrent with clip-move on same clipId → clip-move becomes no-op
  if (
    incoming.type === 'clip-move' &&
    committed.type === 'clip-delete'
  ) {
    if (incoming.payload['clipId'] === committed.payload['clipId']) {
      return null; // drop the clip-move
    }
    return incoming;
  }

  // clip-delete incoming vs clip-move committed: still commit the delete
  // (the clip-move already happened but we delete anyway)
  // Others: append, no conflict
  return incoming;
}

// ── Public API ────────────────────────────────────────────────

export function getOrCreateRoom(projectId: string): CollabRoom {
  const existingId = projectRoomMap.get(projectId);
  if (existingId) {
    const room = rooms.get(existingId);
    if (room) return room;
  }

  const room: CollabRoom = {
    id: uuidv4(),
    projectId,
    ops: [],
    rev: 0,
    presence: new Map(),
    connections: new Map(),
  };

  rooms.set(room.id, room);
  projectRoomMap.set(projectId, room.id);
  // Persist room metadata so projectId→roomId mapping survives restart
  collabRepository.upsertRoom(room.id, projectId, 0).catch(() => {});
  return room;
}

export function addConnection(
  roomId: string,
  userId: string,
  presence: RoomPresence,
  send: (e: CollabEvent) => void,
): () => void {
  const room = rooms.get(roomId);
  if (!room) {
    send({ type: 'error', message: `Room ${roomId} not found` });
    return () => { /* no-op */ };
  }

  // Cancel any pending eviction since we have a new connection
  cancelEviction(roomId);

  // Register connection
  room.connections.set(userId, send);
  room.presence.set(userId, { ...presence, lastSeen: Date.now() });

  // Send connected event with recent ops
  const recentOps = room.ops.slice(-RECENT_OPS_ON_CONNECT);
  send({ type: 'connected', roomId: room.id, rev: room.rev, recentOps });

  // Broadcast updated presence to all (including newcomer)
  broadcastToRoom(room, { type: 'presence', presence: getPresenceList(room) });

  // Return cleanup function
  return () => {
    cleanupConnection(roomId, userId);
  };
}

export function submitOp(op: CollabOp): CommittedOp | null {
  const room = rooms.get(op.roomId);
  if (!room) return null;

  // Apply OT transform
  const transformed = otTransform(room, op);
  if (transformed === null) return null; // op dropped by OT

  // Assign committed revision
  room.rev += 1;
  const committed: CommittedOp = {
    ...transformed,
    committedRev: room.rev,
  };

  // Append to op log, trimming to MAX_OPS
  room.ops.push(committed);
  if (room.ops.length > MAX_OPS) {
    room.ops.splice(0, room.ops.length - MAX_OPS);
  }

  // Touch DB with current rev (fire-and-forget — hot path must stay fast)
  collabRepository.touchRoom(room.id, room.rev).catch(() => {});

  // Broadcast to all connections in the room
  broadcastToRoom(room, { type: 'op', op: committed });

  return committed;
}

// Debounce cursor-move presence broadcasts: max 1 broadcast per user per 100ms
const presenceBroadcastTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function updatePresence(
  roomId: string,
  userId: string,
  cursor: { bar: number; track: string },
): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const existing = room.presence.get(userId);
  if (existing) {
    existing.cursor = cursor;
    existing.lastSeen = Date.now();
  } else {
    // presence not found; ignore silently
    return;
  }

  // Debounce: cancel pending broadcast for this user, schedule new one in 100ms
  const timerKey = `${roomId}:${userId}`
  const existing_timer = presenceBroadcastTimers.get(timerKey)
  if (existing_timer !== undefined) clearTimeout(existing_timer)

  const timer = setTimeout(() => {
    presenceBroadcastTimers.delete(timerKey)
    const r = rooms.get(roomId)
    if (r) broadcastToRoom(r, { type: 'presence', presence: getPresenceList(r) })
  }, 100).unref() // unref so test process can exit cleanly
  presenceBroadcastTimers.set(timerKey, timer)
}

export function getRoomHistory(roomId: string, sinceRev: number): CommittedOp[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return room.ops.filter(op => op.committedRev > sinceRev);
}

export function cleanupConnection(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.connections.delete(userId);
  room.presence.delete(userId);

  // Broadcast updated presence
  broadcastToRoom(room, { type: 'presence', presence: getPresenceList(room) });

  // Schedule eviction if no connections remain
  if (room.connections.size === 0) {
    scheduleEviction(roomId);
  }
}

/** Look up a room by projectId (returns undefined if not found) */
export function getRoomByProjectId(projectId: string): CollabRoom | undefined {
  const roomId = projectRoomMap.get(projectId);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

/** Returns the total number of active SSE connections across all rooms. */
export function getTotalConnections(): number {
  let total = 0
  for (const room of rooms.values()) {
    total += room.connections.size
  }
  return total
}

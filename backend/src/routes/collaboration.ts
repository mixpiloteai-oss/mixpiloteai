// ============================================================
// NEUROTEK AI Backend — Collaboration Routes
// SSE real-time stream + REST write ops + Team management
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import * as collabService from '../services/collaborationService';
import type { CollabOp, CollabOpType, CollabEvent, RoomPresence } from '../services/collaborationService';
// RECENT_OPS_ON_CONNECT matches service constant
const RECENT_OPS_ON_CONNECT = 50;
import * as teamService from '../services/teamService';
import type { TeamRole } from '../services/teamService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { JWT_SECRET } from '../lib/config';
import { db } from '../data/mockDB';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for SSE stream connections: max 10 connects/min per IP (flood protection)
const sseConnectRateLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { success: false, error: 'Too many stream connection attempts.', code: 'SSE_RATE_LIMITED' },
});

// Rate limiter for collaboration ops: max 120 ops/min per user
const collabOpsRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many ops. Slow down.', code: 'COLLAB_RATE_LIMITED' },
});

/**
 * Auth gate for the SSE stream. EventSource cannot set custom headers,
 * so a Bearer token can be passed via `?token=` query param. Falls back
 * to `Authorization: Bearer ...` when present.
 */
function requireAuthSSE(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (typeof req.query['token'] === 'string') {
    token = req.query['token'];
  }
  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string; email: string; name: string; plan: string;
    };
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

const HEARTBEAT_INTERVAL_MS = 25_000;

// ── Helper ────────────────────────────────────────────────────

function getUserId(req: Request): string {
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return 'anonymous';
}

function isCollabOpType(value: unknown): value is CollabOpType {
  const valid: CollabOpType[] = [
    'param-change', 'clip-move', 'clip-add', 'clip-delete',
    'track-add', 'track-delete', 'comment-add', 'comment-resolve',
    'chat-message', 'cursor-move',
  ];
  return typeof value === 'string' && (valid as string[]).includes(value);
}

function isTeamRole(value: unknown): value is TeamRole {
  const valid: TeamRole[] = ['owner', 'editor', 'commenter', 'viewer'];
  return typeof value === 'string' && (valid as string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Format a CollabEvent as an SSE message string */
function formatSSE(event: CollabEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

// ── SSE Stream ────────────────────────────────────────────────

/**
 * GET /api/collab/stream/:projectId
 * Query: ?userId=&userName=&userColor=
 */
router.get('/stream/:projectId', sseConnectRateLimiter, requireAuthSSE, requirePlan('studio'), async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // Fix 1: Verify the authenticated user has access to this project
  const authedUser = (req as AuthenticatedRequest).user;
  const authedUserId = authedUser?.id;
  const project = await db.getProject(projectId);
  const teamPerm = await teamService.getProjectPermission(projectId);
  const userProjectRole = authedUserId !== undefined ? await teamService.getUserProjectRole(authedUserId, projectId) : null;
  const hasTeamAccess = teamPerm
    ? (authedUserId !== undefined && (authedUserId in teamPerm.memberPermissions || userProjectRole !== null))
    : false;
  if (!project && !hasTeamAccess) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  if (project && project.userId && authedUserId && project.userId !== authedUserId && !hasTeamAccess) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  const userId = (typeof req.query['userId'] === 'string' && req.query['userId'])
    ? req.query['userId']
    : getUserId(req);
  const userName = typeof req.query['userName'] === 'string'
    ? req.query['userName']
    : 'Unknown';
  const userColor = typeof req.query['userColor'] === 'string'
    ? req.query['userColor']
    : '#888888';

  // SSE headers — flush immediately
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Use initRoom for persistent state recovery (handles server restart)
  const room = await collabService.initRoom(projectId);

  // Fix 3: Reject connection if room is full
  if (room.connections.size >= collabService.MAX_CONNECTIONS_PER_ROOM) {
    res.write(formatSSE({ type: 'error', message: 'Room is full' }));
    res.end();
    return;
  }

  // If client provides sinceRev, send delta ops instead of last 50
  const clientSinceRev = typeof req.query['sinceRev'] === 'string'
    ? parseInt(req.query['sinceRev'], 10) : undefined;

  const presence: RoomPresence = {
    userId,
    userName,
    userColor,
    lastSeen: Date.now(),
  };

  // SSE sender function
  const send = (event: CollabEvent): void => {
    // Override recentOps on connected event to use sinceRev delta if provided
    if (event.type === 'connected' && clientSinceRev !== undefined && !isNaN(clientSinceRev)) {
      const deltaOps = collabService.getRoomHistory(room.id, clientSinceRev);
      res.write(formatSSE({ ...event, recentOps: deltaOps }));
    } else {
      res.write(formatSSE(event));
    }
    // Flush if available (e.g. compression middleware)
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  const cleanup = collabService.addConnection(room.id, userId, presence, send);

  // Heartbeat to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      // connection already closed
    }
  }, HEARTBEAT_INTERVAL_MS).unref(); // unref so test process can exit cleanly

  // Clean up on disconnect
  const handleClose = (): void => {
    clearInterval(heartbeat);
    cleanup();
  };

  req.on('close', handleClose);
  req.on('aborted', handleClose);
});

// ── Operations ────────────────────────────────────────────────

/**
 * POST /api/collab/ops
 * Body: { projectId, userId, userName, userColor, type, payload, rev }
 */
// Inline validation middleware for /ops — runs before plan check so callers
// get descriptive 400s regardless of subscription tier.
function validateOpsBody(req: Request, res: Response, next: NextFunction): void {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  // Fix 4: Payload size validation
  const payloadStr = JSON.stringify(body);
  if (payloadStr.length > 10_000) {
    res.status(413).json({ success: false, error: 'Payload too large' });
    return;
  }

  const { projectId, userName, userColor, type, payload, rev } = body;

  if (typeof projectId !== 'string' || !projectId) {
    res.status(400).json({ success: false, error: 'projectId required' });
    return;
  }

  // Fix 4: Validate userName, userColor, rev
  if (userName !== undefined && (typeof userName !== 'string' || (userName as string).length > 50)) {
    res.status(400).json({ success: false, error: 'userName must be a string of max 50 chars' });
    return;
  }
  if (userColor !== undefined && (typeof userColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(userColor as string))) {
    res.status(400).json({ success: false, error: 'userColor must be a valid hex color (#rrggbb)' });
    return;
  }
  if (rev !== undefined && (typeof rev !== 'number' || !Number.isInteger(rev) || (rev as number) < 0)) {
    res.status(400).json({ success: false, error: 'rev must be a non-negative integer' });
    return;
  }

  if (!isCollabOpType(type)) {
    res.status(400).json({ success: false, error: 'Invalid op type' });
    return;
  }
  if (!isRecord(payload)) {
    res.status(400).json({ success: false, error: 'payload must be an object' });
    return;
  }

  next();
}

router.post('/ops', requireAuth, collabOpsRateLimiter, validateOpsBody, requirePlan('studio'), async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  // projectId, type, payload already validated by validateOpsBody — safe to cast
  const projectId = body['projectId'] as string;
  const userId = body['userId'];
  const userName = body['userName'];
  const userColor = body['userColor'];
  const type = body['type'] as CollabOpType;
  const payload = body['payload'] as Record<string, unknown>;
  const rev = body['rev'];

  // Fix 1: Verify the authenticated user has access to this project
  const authedUser = (req as AuthenticatedRequest).user;
  const authedUserId = authedUser?.id;
  const project = await db.getProject(projectId);
  const teamPerm = await teamService.getProjectPermission(projectId);
  const userProjectRole = authedUserId !== undefined ? await teamService.getUserProjectRole(authedUserId, projectId) : null;
  const hasTeamAccess = teamPerm
    ? (authedUserId !== undefined && (authedUserId in teamPerm.memberPermissions || userProjectRole !== null))
    : false;
  if (!project && !hasTeamAccess) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  if (project && project.userId && authedUserId && project.userId !== authedUserId && !hasTeamAccess) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  const room = collabService.getOrCreateRoom(projectId);

  const op: CollabOp = {
    id: uuidv4(),
    roomId: room.id,
    userId: typeof userId === 'string' ? userId : getUserId(req),
    userName: typeof userName === 'string' ? userName : 'Unknown',
    userColor: typeof userColor === 'string' ? userColor : '#888888',
    type,
    payload,
    rev: typeof rev === 'number' ? rev : 0,
    timestamp: Date.now(),
  };

  const committed = collabService.submitOp(op);
  if (!committed) {
    // Op was dropped by OT (e.g. conflict resolved, no-op)
    res.json({ success: true, op: null, dropped: true });
    return;
  }

  res.json({ success: true, op: committed });
});

// ── History ───────────────────────────────────────────────────

/**
 * GET /api/collab/history/:projectId
 * Query: ?since=0
 */
router.get('/history/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const sinceRaw = req.query['since'];
  const since = typeof sinceRaw === 'string' ? parseInt(sinceRaw, 10) : 0;

  const room = collabService.getOrCreateRoom(projectId);
  const ops = collabService.getRoomHistory(room.id, isNaN(since) ? 0 : since);

  res.json({ success: true, ops, rev: room.rev });
});

// ── Presence ──────────────────────────────────────────────────

/**
 * POST /api/collab/presence
 * Body: { projectId, userId, bar, track }
 */
router.post('/presence', requireAuth, (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { projectId, userId, bar, track } = body;

  if (typeof projectId !== 'string' || !projectId) {
    res.status(400).json({ success: false, error: 'projectId required' });
    return;
  }

  const room = collabService.getRoomByProjectId(projectId);
  if (!room) {
    res.status(404).json({ success: false, error: 'Room not found' });
    return;
  }

  const uid = typeof userId === 'string' ? userId : getUserId(req);
  collabService.updatePresence(room.id, uid, {
    bar: typeof bar === 'number' ? bar : 0,
    track: typeof track === 'string' ? track : '',
  });

  res.json({ success: true });
});

/**
 * GET /api/collab/rooms/:projectId/presence
 */
router.get('/rooms/:projectId/presence', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const room = collabService.getRoomByProjectId(projectId);
  if (!room) {
    res.json({ success: true, presence: [] });
    return;
  }

  const presence = Array.from(room.presence.values());
  res.json({ success: true, presence });
});

// ── Invitations ───────────────────────────────────────────────

/**
 * POST /api/collab/invite
 * Body: { teamId, email, role }
 */
router.post('/invite', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { teamId, email, role } = body;

  if (typeof teamId !== 'string' || !teamId) {
    res.status(400).json({ success: false, error: 'teamId required' });
    return;
  }
  if (typeof email !== 'string' || !email) {
    res.status(400).json({ success: false, error: 'email required' });
    return;
  }
  if (!isTeamRole(role)) {
    res.status(400).json({ success: false, error: 'Invalid role' });
    return;
  }

  const invitedBy = getUserId(req);
  const invitation = await teamService.createInvitation(teamId, email, role, invitedBy);

  if (!invitation) {
    res.status(404).json({ success: false, error: 'Team not found' });
    return;
  }

  res.status(201).json({ success: true, invitation });
});

/**
 * GET /api/collab/invite/:token
 */
router.get('/invite/:token', async (req: Request, res: Response) => {
  const invitation = await teamService.getInvitation(req.params.token);
  if (!invitation) {
    res.status(404).json({ success: false, error: 'Invitation not found' });
    return;
  }

  if (Date.now() > invitation.expiresAt) {
    res.status(410).json({ success: false, error: 'Invitation expired' });
    return;
  }

  res.json({ success: true, invitation });
});

/**
 * POST /api/collab/invite/:token/accept
 * Body: { userId, userName }
 */
router.post('/invite/:token/accept', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { userId, userName } = body;
  const uid = typeof userId === 'string' ? userId : getUserId(req);
  const uname = typeof userName === 'string' ? userName : 'Unknown';

  const member = await teamService.acceptInvitation(req.params.token, uid, uname);
  if (!member) {
    res.status(400).json({ success: false, error: 'Invitation invalid, expired, or already accepted' });
    return;
  }

  res.json({ success: true, member });
});

// ── Permissions ───────────────────────────────────────────────

/**
 * GET /api/collab/permissions/:projectId
 */
router.get('/permissions/:projectId', async (req: Request, res: Response) => {
  const perm = await teamService.getProjectPermission(req.params.projectId);
  if (!perm) {
    res.status(404).json({ success: false, error: 'No permissions set for this project' });
    return;
  }
  res.json({ success: true, permission: perm });
});

/**
 * PATCH /api/collab/permissions/:projectId
 * Body: { teamId, memberPermissions }
 */
router.patch('/permissions/:projectId', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { teamId, memberPermissions } = body;

  if (typeof teamId !== 'string' || !teamId) {
    res.status(400).json({ success: false, error: 'teamId required' });
    return;
  }

  // Validate memberPermissions is a Record<string, TeamRole>
  const perms: Record<string, TeamRole> = {};
  if (isRecord(memberPermissions)) {
    for (const [uid, role] of Object.entries(memberPermissions)) {
      if (isTeamRole(role)) {
        perms[uid] = role;
      }
    }
  }

  const permission = await teamService.setProjectPermission(req.params.projectId, teamId, perms);
  res.json({ success: true, permission });
});

// ── Teams ─────────────────────────────────────────────────────

/**
 * POST /api/teams
 * Body: { name, ownerName, ownerEmail }
 */
router.post('/teams-create', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { name, ownerName, ownerEmail } = body;

  if (typeof name !== 'string' || !name) {
    res.status(400).json({ success: false, error: 'name required' });
    return;
  }

  const ownerId = getUserId(req);
  const team = await teamService.createTeam(
    name,
    ownerId,
    typeof ownerName === 'string' ? ownerName : 'Owner',
    typeof ownerEmail === 'string' ? ownerEmail : '',
  );

  res.status(201).json({ success: true, team });
});

// ── Snapshot ──────────────────────────────────────────────────

/**
 * GET /api/collab/snapshot/:projectId
 * Returns latest snapshot info for a project's collab room.
 */
router.get('/snapshot/:projectId', requireAuthSSE, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const room = await collabService.initRoom(projectId);
  res.json({ success: true, data: { roomId: room.id, rev: room.rev, opsInMemory: room.ops.length } });
});

// NOTE: Team routes are also exported on this router but mounted under /api/teams
// in index.ts. The following handlers match /api/teams/... paths.

export default router;

// ─────────────────────────────────────────────────────────────
// Team-specific sub-router (mounted at /api/teams)
// We export a second router for teams so index.ts can mount them separately
// ─────────────────────────────────────────────────────────────

export const teamsRouter = Router();

/**
 * POST /api/teams
 */
teamsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { name, ownerName, ownerEmail } = body;

  if (typeof name !== 'string' || !name) {
    res.status(400).json({ success: false, error: 'name required' });
    return;
  }

  const ownerId = getUserId(req);
  const team = await teamService.createTeam(
    name,
    ownerId,
    typeof ownerName === 'string' ? ownerName : 'Owner',
    typeof ownerEmail === 'string' ? ownerEmail : '',
  );

  res.status(201).json({ success: true, team });
});

/**
 * GET /api/teams
 */
teamsRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const userTeams = await teamService.listUserTeams(userId);
  res.json({ success: true, teams: userTeams });
});

/**
 * GET /api/teams/:id
 */
teamsRouter.get('/:id', async (req: Request, res: Response) => {
  const team = await teamService.getTeam(req.params.id);
  if (!team) {
    res.status(404).json({ success: false, error: 'Team not found' });
    return;
  }
  res.json({ success: true, team });
});

/**
 * POST /api/teams/:id/members
 * Body: { userId, userName, email, role }
 */
teamsRouter.post('/:id/members', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { userId, userName, email, role } = body;

  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ success: false, error: 'userId required' });
    return;
  }
  if (typeof email !== 'string' || !email) {
    res.status(400).json({ success: false, error: 'email required' });
    return;
  }
  if (!isTeamRole(role)) {
    res.status(400).json({ success: false, error: 'Invalid role' });
    return;
  }

  const member = await teamService.addMember(
    req.params.id,
    userId,
    typeof userName === 'string' ? userName : 'Unknown',
    email,
    role,
  );

  if (!member) {
    res.status(400).json({ success: false, error: 'Could not add member (team not found or already a member)' });
    return;
  }

  res.status(201).json({ success: true, member });
});

/**
 * DELETE /api/teams/:id/members/:uid
 */
teamsRouter.delete('/:id/members/:uid', requireAuth, async (req: Request, res: Response) => {
  const removed = await teamService.removeMember(req.params.id, req.params.uid);
  if (!removed) {
    res.status(400).json({ success: false, error: 'Could not remove member' });
    return;
  }
  res.json({ success: true });
});

/**
 * PATCH /api/teams/:id/members/:uid
 * Body: { role }
 */
teamsRouter.patch('/:id/members/:uid', requireAuth, async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  const { role } = body;
  if (!isTeamRole(role)) {
    res.status(400).json({ success: false, error: 'Invalid role' });
    return;
  }

  const updated = await teamService.updateMemberRole(req.params.id, req.params.uid, role);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Team or member not found' });
    return;
  }

  res.json({ success: true });
});

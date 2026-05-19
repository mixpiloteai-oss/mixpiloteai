// ============================================================
// NEUROTEK AI Backend — Team Service
// In-memory team/invitation management
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

// ── Types ─────────────────────────────────────────────────────

export type TeamRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface TeamMember {
  userId: string;
  userName: string;
  email: string;
  role: TeamRole;
  joinedAt: number;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  members: TeamMember[];
  createdAt: number;
}

export interface Invitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  token: string;
  expiresAt: number;
  accepted: boolean;
}

export interface ProjectPermission {
  projectId: string;
  teamId: string;
  memberPermissions: Record<string, TeamRole>;
}

// ── Internal state ────────────────────────────────────────────

const teams = new Map<string, Team>();
const invitations = new Map<string, Invitation>(); // token → Invitation
const projectPermissions = new Map<string, ProjectPermission>(); // projectId → permission

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Helpers ───────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(16).toString('hex'); // 32 hex chars
}

const ROLE_WEIGHT: Record<TeamRole, number> = {
  owner: 4,
  editor: 3,
  commenter: 2,
  viewer: 1,
};

function roleCanEdit(role: TeamRole): boolean {
  return role === 'owner' || role === 'editor';
}

// ── Teams ─────────────────────────────────────────────────────

export function createTeam(name: string, ownerId: string, ownerName: string, ownerEmail: string): Team {
  const team: Team = {
    id: uuidv4(),
    name,
    ownerId,
    members: [
      {
        userId: ownerId,
        userName: ownerName,
        email: ownerEmail,
        role: 'owner',
        joinedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
  };
  teams.set(team.id, team);
  return team;
}

export function getTeam(teamId: string): Team | undefined {
  return teams.get(teamId);
}

export function listUserTeams(userId: string): Team[] {
  const result: Team[] = [];
  for (const team of teams.values()) {
    if (team.members.some(m => m.userId === userId)) {
      result.push(team);
    }
  }
  return result;
}

export function addMember(
  teamId: string,
  userId: string,
  userName: string,
  email: string,
  role: TeamRole,
): TeamMember | null {
  const team = teams.get(teamId);
  if (!team) return null;

  // Don't add if already a member
  if (team.members.some(m => m.userId === userId)) return null;

  const member: TeamMember = {
    userId,
    userName,
    email,
    role,
    joinedAt: Date.now(),
  };
  team.members.push(member);
  return member;
}

export function removeMember(teamId: string, userId: string): boolean {
  const team = teams.get(teamId);
  if (!team) return false;

  const idx = team.members.findIndex(m => m.userId === userId);
  if (idx === -1) return false;

  // Cannot remove owner
  if (team.members[idx].role === 'owner') return false;

  team.members.splice(idx, 1);
  return true;
}

export function updateMemberRole(teamId: string, userId: string, role: TeamRole): boolean {
  const team = teams.get(teamId);
  if (!team) return false;

  const member = team.members.find(m => m.userId === userId);
  if (!member) return false;

  member.role = role;
  return true;
}

// ── Invitations ───────────────────────────────────────────────

export function createInvitation(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string,
): Invitation | null {
  if (!teams.has(teamId)) return null;

  const token = generateToken();
  const invitation: Invitation = {
    id: uuidv4(),
    teamId,
    email,
    role,
    invitedBy,
    token,
    expiresAt: Date.now() + INVITE_TTL_MS,
    accepted: false,
  };
  invitations.set(token, invitation);
  return invitation;
}

export function getInvitation(token: string): Invitation | undefined {
  return invitations.get(token);
}

export function acceptInvitation(
  token: string,
  userId: string,
  userName: string,
): TeamMember | null {
  const invitation = invitations.get(token);
  if (!invitation) return null;
  if (invitation.accepted) return null;
  if (Date.now() > invitation.expiresAt) return null;

  const member = addMember(invitation.teamId, userId, userName, invitation.email, invitation.role);
  if (!member) {
    // User might already be a member; still mark accepted
    invitation.accepted = true;
    return null;
  }

  invitation.accepted = true;
  return member;
}

export function listTeamInvitations(teamId: string): Invitation[] {
  const result: Invitation[] = [];
  for (const inv of invitations.values()) {
    if (inv.teamId === teamId) {
      result.push(inv);
    }
  }
  return result;
}

// ── Project Permissions ───────────────────────────────────────

export function setProjectPermission(
  projectId: string,
  teamId: string,
  memberPermissions: Record<string, TeamRole>,
): ProjectPermission {
  const permission: ProjectPermission = { projectId, teamId, memberPermissions };
  projectPermissions.set(projectId, permission);
  return permission;
}

export function getProjectPermission(projectId: string): ProjectPermission | undefined {
  return projectPermissions.get(projectId);
}

export function canUserEditProject(userId: string, projectId: string): boolean {
  const perm = projectPermissions.get(projectId);
  if (!perm) {
    // No explicit permission set → open (default allow)
    return true;
  }

  // Check member-level override first
  const memberRole = perm.memberPermissions[userId];
  if (memberRole) {
    return roleCanEdit(memberRole);
  }

  // Fallback: check team membership
  const team = teams.get(perm.teamId);
  if (!team) return false;

  const member = team.members.find(m => m.userId === userId);
  if (!member) return false;

  return roleCanEdit(member.role);
}

/** Returns the effective role weight for a user on a project (higher = more access) */
export function getUserProjectRole(userId: string, projectId: string): TeamRole | null {
  const perm = projectPermissions.get(projectId);
  if (!perm) return null;

  const memberRole = perm.memberPermissions[userId];
  if (memberRole) return memberRole;

  const team = teams.get(perm.teamId);
  if (!team) return null;

  const member = team.members.find(m => m.userId === userId);
  return member?.role ?? null;
}

// Keep weight accessible for external consumers
export { ROLE_WEIGHT };

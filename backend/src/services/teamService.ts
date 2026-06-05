// ============================================================
// NEUROTEK AI Backend — Team Service
// When Supabase is configured: persists in PostgreSQL.
// When Supabase is NOT configured (dev/test): uses in-memory
// Maps so the server boots and tests pass.
// ============================================================

import { v4 as uuidv4 }        from 'uuid'
import { randomBytes }          from 'crypto'
import { isSupabaseConfigured } from '../lib/supabase'
import { teamRepository }       from '../repositories/teamRepository'

// ── Types ─────────────────────────────────────────────────────
export type TeamRole = 'owner' | 'editor' | 'commenter' | 'viewer'

export interface TeamMember {
  userId: string; userName: string; email: string
  role: TeamRole; joinedAt: number
}

export interface Team {
  id: string; name: string; ownerId: string
  members: TeamMember[]; createdAt: number
}

export interface Invitation {
  id: string; teamId: string; email: string; role: TeamRole
  invitedBy: string; token: string; expiresAt: number; accepted: boolean
}

export interface ProjectPermission {
  projectId: string; teamId: string
  memberPermissions: Record<string, TeamRole>
}

// ── Constants ─────────────────────────────────────────────────
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

export const ROLE_WEIGHT: Record<TeamRole, number> = {
  owner: 4, editor: 3, commenter: 2, viewer: 1,
}

// ── In-memory fallback stores (used only when Supabase NOT configured) ──
const _teams       = new Map<string, Team>()
const _invitations = new Map<string, Invitation>()          // token → invitation
const _projectPerms= new Map<string, ProjectPermission>()   // projectId → perm

// ── Mappers ───────────────────────────────────────────────────
function rowToMember(r: any): TeamMember {
  return {
    userId:   r.user_id,
    userName: r.user_name,
    email:    r.email,
    role:     r.role as TeamRole,
    joinedAt: new Date(r.joined_at).getTime(),
  }
}

function rowToTeam(r: any, members: TeamMember[] = []): Team {
  return {
    id:        r.id,
    name:      r.name,
    ownerId:   r.owner_id,
    members,
    createdAt: new Date(r.created_at).getTime(),
  }
}

function rowToInvitation(r: any): Invitation {
  return {
    id:         r.id,
    teamId:     r.team_id,
    email:      r.email,
    role:       r.role as TeamRole,
    invitedBy:  r.invited_by,
    token:      r.token,
    expiresAt:  new Date(r.expires_at).getTime(),
    accepted:   r.accepted,
  }
}

function generateToken(): string {
  return randomBytes(16).toString('hex')
}

function roleCanEdit(role: TeamRole): boolean {
  return role === 'owner' || role === 'editor'
}

// ── Teams ─────────────────────────────────────────────────────
export async function createTeam(
  name: string, ownerId: string, ownerName: string, ownerEmail: string
): Promise<Team> {
  if (!isSupabaseConfigured) {
    const team: Team = {
      id: uuidv4(), name, ownerId, createdAt: Date.now(),
      members: [{ userId: ownerId, userName: ownerName, email: ownerEmail, role: 'owner', joinedAt: Date.now() }],
    }
    _teams.set(team.id, team)
    return team
  }
  const row = await teamRepository.create({ name, owner_id: ownerId })
  await teamRepository.addMember({
    team_id:   row.id,
    user_id:   ownerId,
    user_name: ownerName,
    email:     ownerEmail,
    role:      'owner',
  })
  const members = await teamRepository.getMembers(row.id)
  return rowToTeam(row, members.map(rowToMember))
}

export async function getTeam(teamId: string): Promise<Team | undefined> {
  if (!isSupabaseConfigured) return _teams.get(teamId)
  const row = await teamRepository.findById(teamId)
  if (!row) return undefined
  const members = await teamRepository.getMembers(teamId)
  return rowToTeam(row, members.map(rowToMember))
}

export async function listUserTeams(userId: string): Promise<Team[]> {
  if (!isSupabaseConfigured) {
    return Array.from(_teams.values()).filter(t =>
      t.members.some(m => m.userId === userId)
    )
  }
  const rows = await teamRepository.listByUser(userId)
  return Promise.all(rows.map(async (r: any) => {
    const members = await teamRepository.getMembers(r.id)
    return rowToTeam(r, members.map(rowToMember))
  }))
}

export async function addMember(
  teamId: string, userId: string, userName: string, email: string, role: TeamRole
): Promise<TeamMember | null> {
  if (!isSupabaseConfigured) {
    const team = _teams.get(teamId)
    if (!team) return null
    const member: TeamMember = { userId, userName, email, role, joinedAt: Date.now() }
    team.members = team.members.filter(m => m.userId !== userId)
    team.members.push(member)
    return member
  }
  await teamRepository.addMember({ team_id: teamId, user_id: userId, user_name: userName, email, role })
  const m = await teamRepository.getMember(teamId, userId)
  return m ? rowToMember(m) : null
}

export async function removeMember(teamId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const team = _teams.get(teamId)
    if (!team) return false
    const member = team.members.find(m => m.userId === userId)
    if (!member || member.role === 'owner') return false
    team.members = team.members.filter(m => m.userId !== userId)
    return true
  }
  const m = await teamRepository.getMember(teamId, userId)
  if (!m) return false
  if (m.role === 'owner') return false   // cannot remove owner
  await teamRepository.removeMember(teamId, userId)
  return true
}

export async function updateMemberRole(teamId: string, userId: string, role: TeamRole): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const team = _teams.get(teamId)
    if (!team) return false
    const member = team.members.find(m => m.userId === userId)
    if (!member) return false
    member.role = role
    return true
  }
  const m = await teamRepository.getMember(teamId, userId)
  if (!m) return false
  await teamRepository.updateMemberRole(teamId, userId, role)
  return true
}

// ── Invitations ───────────────────────────────────────────────
export async function createInvitation(
  teamId: string, email: string, role: TeamRole, invitedBy: string
): Promise<Invitation | null> {
  if (!isSupabaseConfigured) {
    if (!_teams.has(teamId)) return null
    const token = generateToken()
    const inv: Invitation = {
      id: uuidv4(), teamId, email, role, invitedBy, token,
      expiresAt: Date.now() + INVITE_TTL_MS, accepted: false,
    }
    _invitations.set(token, inv)
    return inv
  }
  const team = await teamRepository.findById(teamId)
  if (!team) return null
  const token     = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const row = await teamRepository.createInvitation({
    team_id:    teamId,
    email,
    role,
    invited_by: invitedBy,
    token,
    expires_at: expiresAt,
  })
  return rowToInvitation(row)
}

export async function getInvitation(token: string): Promise<Invitation | undefined> {
  if (!isSupabaseConfigured) return _invitations.get(token)
  const row = await teamRepository.findInvitationByToken(token)
  return row ? rowToInvitation(row) : undefined
}

export async function acceptInvitation(
  token: string, userId: string, userName: string
): Promise<TeamMember | null> {
  if (!isSupabaseConfigured) {
    const inv = _invitations.get(token)
    if (!inv || inv.accepted || inv.expiresAt < Date.now()) return null
    inv.accepted = true
    return addMember(inv.teamId, userId, userName, inv.email, inv.role)
  }
  const row = await teamRepository.findInvitationByToken(token)
  if (!row)            return null
  if (row.accepted)    return null
  if (new Date(row.expires_at) < new Date()) return null

  await teamRepository.addMember({
    team_id:   row.team_id,
    user_id:   userId,
    user_name: userName,
    email:     row.email,
    role:      row.role,
  })
  await teamRepository.acceptInvitation(token)
  const m = await teamRepository.getMember(row.team_id, userId)
  return m ? rowToMember(m) : null
}

export async function listTeamInvitations(teamId: string): Promise<Invitation[]> {
  if (!isSupabaseConfigured) {
    return Array.from(_invitations.values()).filter(i => i.teamId === teamId)
  }
  const { supabase, isSupabaseConfigured: isDB } = await import('../lib/db')
  if (!isDB || !supabase) return []
  const { data } = await supabase.from('team_invitations').select('*').eq('team_id', teamId)
  return (data ?? []).map(rowToInvitation)
}

// ── Project Permissions ───────────────────────────────────────
export async function setProjectPermission(
  projectId: string, teamId: string, memberPermissions: Record<string, TeamRole>
): Promise<ProjectPermission> {
  const perm: ProjectPermission = { projectId, teamId, memberPermissions }
  if (!isSupabaseConfigured) {
    _projectPerms.set(projectId, perm)
    return perm
  }
  await teamRepository.setProjectPermissions({
    project_id:         projectId,
    team_id:            teamId,
    member_permissions: memberPermissions,
  })
  return perm
}

export async function getProjectPermission(projectId: string): Promise<ProjectPermission | undefined> {
  if (!isSupabaseConfigured) return _projectPerms.get(projectId)
  const row = await teamRepository.getProjectPermissions(projectId)
  if (!row) return undefined
  return {
    projectId:         row.project_id,
    teamId:            row.team_id,
    memberPermissions: row.member_permissions ?? {},
  }
}

export async function canUserEditProject(userId: string, projectId: string): Promise<boolean> {
  const perm = await getProjectPermission(projectId)
  if (!perm) return true    // no restriction → open

  const memberRole = perm.memberPermissions[userId]
  if (memberRole) return roleCanEdit(memberRole)

  const team = await getTeam(perm.teamId)
  if (!team) return false

  const member = team.members.find(m => m.userId === userId)
  if (!member) return false
  return roleCanEdit(member.role)
}

export async function getUserProjectRole(userId: string, projectId: string): Promise<TeamRole | null> {
  const perm = await getProjectPermission(projectId)
  if (!perm) return null

  const memberRole = perm.memberPermissions[userId]
  if (memberRole) return memberRole

  const team = await getTeam(perm.teamId)
  if (!team) return null

  return team.members.find(m => m.userId === userId)?.role ?? null
}

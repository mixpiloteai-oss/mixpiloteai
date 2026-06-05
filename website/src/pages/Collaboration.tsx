import { useState } from 'react'
import './Collaboration.css'

/* ── Types ──────────────────────────────────────────────── */

interface Member {
  userId: string
  userName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  avatarColor: string
}

interface Team {
  id: string
  name: string
  members: Member[]
}

interface PendingInvite {
  id: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  expiry: string
}

interface LiveSession {
  userId: string
  userName: string
  project: string
  joinedMinsAgo: number
  avatarColor: string
}

type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

/* ── Mock data ───────────────────────────────────────────── */

const MOCK_TEAMS: Team[] = [
  {
    id: '1',
    name: 'Dark Collective',
    members: [
      { userId: 'u1', userName: 'Alex', email: 'alex@email.com', role: 'owner', avatarColor: 'avatar-purple' },
      { userId: 'u2', userName: 'Sam', email: 'sam@email.com', role: 'editor', avatarColor: 'avatar-cyan' },
      { userId: 'u3', userName: 'Mia', email: 'mia@email.com', role: 'commenter', avatarColor: 'avatar-pink' },
    ],
  },
  {
    id: '2',
    name: 'Acid Lab Crew',
    members: [
      { userId: 'u4', userName: 'Dre', email: 'dre@email.com', role: 'owner', avatarColor: 'avatar-orange' },
      { userId: 'u5', userName: 'Kim', email: 'kim@email.com', role: 'editor', avatarColor: 'avatar-green' },
    ],
  },
  {
    id: '3',
    name: 'Melodic Ensemble',
    members: [
      { userId: 'u6', userName: 'Jan', email: 'jan@email.com', role: 'owner', avatarColor: 'avatar-cyan' },
      { userId: 'u7', userName: 'Lee', email: 'lee@email.com', role: 'editor', avatarColor: 'avatar-purple' },
      { userId: 'u8', userName: 'Ren', email: 'ren@email.com', role: 'viewer', avatarColor: 'avatar-pink' },
      { userId: 'u9', userName: 'Zoe', email: 'zoe@email.com', role: 'commenter', avatarColor: 'avatar-green' },
    ],
  },
]

const MOCK_PENDING: PendingInvite[] = [
  { id: 'i1', email: 'producer@studio.io', role: 'editor', expiry: 'Expires in 6 days' },
  { id: 'i2', email: 'beatmaker@groove.fm', role: 'viewer', expiry: 'Expires in 2 days' },
  { id: 'i3', email: 'collab@darktek.net', role: 'commenter', expiry: 'Expires in 14 days' },
]

const MOCK_PROJECTS = ['Dark Hardtek Session', 'Acid Breaks Vol.2', 'Melodic Techno EP']

const PERMISSIONS_DATA: { member: Member; projectRoles: Role[] }[] = [
  {
    member: { userId: 'u1', userName: 'Alex', email: 'alex@email.com', role: 'owner', avatarColor: 'avatar-purple' },
    projectRoles: ['owner', 'owner', 'editor'],
  },
  {
    member: { userId: 'u2', userName: 'Sam', email: 'sam@email.com', role: 'editor', avatarColor: 'avatar-cyan' },
    projectRoles: ['editor', 'commenter', 'viewer'],
  },
  {
    member: { userId: 'u3', userName: 'Mia', email: 'mia@email.com', role: 'commenter', avatarColor: 'avatar-pink' },
    projectRoles: ['viewer', 'editor', 'commenter'],
  },
]

const MOCK_SESSIONS: LiveSession[] = [
  { userId: 's1', userName: 'Alex', project: 'Dark Hardtek Session', joinedMinsAgo: 4, avatarColor: 'avatar-purple' },
  { userId: 's2', userName: 'Sam', project: 'Acid Breaks Vol.2', joinedMinsAgo: 11, avatarColor: 'avatar-cyan' },
  { userId: 's3', userName: 'Dre', project: 'Melodic Techno EP', joinedMinsAgo: 23, avatarColor: 'avatar-orange' },
]

/* ── Helpers ─────────────────────────────────────────────── */

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function roleLabelShort(role: Role): string {
  const map: Record<Role, string> = {
    owner: 'Can edit',
    editor: 'Can edit',
    commenter: 'Can comment',
    viewer: 'View only',
  }
  return map[role]
}

/* ── Component ───────────────────────────────────────────── */

function Collaboration() {
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('editor')
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(MOCK_PENDING)

  const [copiedLink, setCopiedLink] = useState(false)

  function handleCreateTeam() {
    const name = teamName.trim()
    if (!name) return
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name,
      members: [
        { userId: 'me', userName: 'You', email: 'me@email.com', role: 'owner', avatarColor: 'avatar-purple' },
      ],
    }
    setTeams([newTeam, ...teams])
    setTeamName('')
  }

  function handleSendInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    const invite: PendingInvite = {
      id: `i${Date.now()}`,
      email,
      role: inviteRole,
      expiry: 'Expires in 7 days',
    }
    setPendingInvites([invite, ...pendingInvites])
    setInviteEmail('')
  }

  function handleRevoke(id: string) {
    setPendingInvites(pendingInvites.filter((inv) => inv.id !== id))
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText('https://mixpilote.ai/invite/abc123xyz')
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="collab-page">
      {/* Hero */}
      <div className="collab-hero">
        <div className="container">
          <div className="section-label">Collaboration</div>
          <h1 className="collab-title">
            Studio <span className="gradient-text">Collaboration</span>
          </h1>
          <p className="collab-subtitle">Real-time co-production with your team</p>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <div className="collab-grid">

            {/* ── Teams ──────────────────────────────────── */}
            <div className="glass-card collab-card-pad">
              <div className="collab-section-title">
                <div className="collab-section-icon purple">👥</div>
                My Teams
              </div>

              <div className="collab-create-form">
                <input
                  className="collab-input"
                  type="text"
                  placeholder="New team name…"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                />
                <button className="btn-primary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={handleCreateTeam}>
                  Create Team
                </button>
              </div>

              <div className="collab-team-list">
                {teams.map((team) => (
                  <div key={team.id} className="collab-team-card">
                    <div className="collab-team-info">
                      <div className="collab-team-name">{team.name}</div>
                      <div className="collab-team-meta">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="collab-member-avatars">
                      {team.members.slice(0, 4).map((m) => (
                        <div key={m.userId} className={`collab-member-avatar ${m.avatarColor}`} title={m.userName}>
                          {initials(m.userName)}
                        </div>
                      ))}
                      {team.members.length > 4 && (
                        <div className="collab-member-avatar avatar-purple" title="More members">
                          +{team.members.length - 4}
                        </div>
                      )}
                    </div>
                    <button className="collab-manage-btn">Manage</button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Invite ─────────────────────────────────── */}
            <div className="glass-card collab-card-pad">
              <div className="collab-section-title">
                <div className="collab-section-icon cyan">✉️</div>
                Invite Collaborators
              </div>

              <div className="collab-invite-form">
                <input
                  className="collab-input"
                  type="email"
                  placeholder="colleague@studio.io"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                />
                <select
                  className="collab-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className="btn-primary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={handleSendInvite}>
                  Send Invite
                </button>
              </div>

              <div className="collab-section-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '10px' }}>
                Pending Invitations
              </div>

              <div className="collab-invite-list">
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="collab-invite-item">
                    <span className="collab-invite-email">{inv.email}</span>
                    <span className={`collab-role-badge ${inv.role}`}>{inv.role}</span>
                    <span className="collab-invite-expiry">{inv.expiry}</span>
                    <button className="collab-revoke-btn" onClick={() => handleRevoke(inv.id)}>Revoke</button>
                  </div>
                ))}
              </div>

              <button className="collab-copy-link-btn" onClick={handleCopyLink}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="5" y="1" width="9" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 5v8a2 2 0 0 0 2 2h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {copiedLink ? 'Copied!' : 'Copy invite link'}
              </button>
            </div>

            {/* ── Permissions ────────────────────────────── */}
            <div className="glass-card collab-card-pad collab-full-width">
              <div className="collab-section-title">
                <div className="collab-section-icon green">🔐</div>
                Project Permissions
              </div>

              <div className="collab-permissions-table-wrap">
                <table className="collab-permissions-grid">
                  <thead>
                    <tr>
                      <th>Member</th>
                      {MOCK_PROJECTS.map((p) => (
                        <th key={p} style={{ textAlign: 'center' }}>{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS_DATA.map(({ member, projectRoles }) => (
                      <tr key={member.userId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className={`collab-member-avatar ${member.avatarColor}`} style={{ width: 30, height: 30, fontSize: 11 }}>
                              {initials(member.userName)}
                            </div>
                            <span className="collab-project-name-cell">{member.userName}</span>
                          </div>
                        </td>
                        {projectRoles.map((role, idx) => (
                          <td key={idx} className="collab-perm-cell">
                            <div className="collab-perm-cell-inner">
                              <span className={`collab-role-badge ${role}`}>{role}</span>
                              <span className="collab-perm-label">{roleLabelShort(role)}</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Live Sessions ───────────────────────────── */}
            <div className="glass-card collab-card-pad">
              <div className="collab-section-title">
                <div className="collab-section-icon green">🟢</div>
                <span>Live Sessions</span>
                <div className="collab-live-indicator" style={{ marginLeft: 'auto' }}>
                  <div className="collab-pulse" />
                  <span className="collab-live-label">Live</span>
                </div>
              </div>

              <div className="collab-sessions-list">
                {MOCK_SESSIONS.map((session) => (
                  <div key={session.userId} className="collab-session-item">
                    <div className={`collab-session-avatar ${session.avatarColor}`}>
                      {initials(session.userName)}
                    </div>
                    <div className="collab-session-info">
                      <div className="collab-session-user">{session.userName}</div>
                      <div className="collab-session-project">
                        editing <span>{session.project}</span>
                      </div>
                    </div>
                    <div className="collab-session-time">joined {session.joinedMinsAgo}m ago</div>
                    <div className="collab-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── How It Works ───────────────────────────── */}
            <div className="glass-card collab-card-pad">
              <div className="collab-section-title">
                <div className="collab-section-icon orange">💡</div>
                How It Works
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { step: 'Step 1', icon: '👥', title: 'Create your team', desc: 'Set up a named team for your studio crew, label collective, or project group.' },
                  { step: 'Step 2', icon: '✉️', title: 'Invite collaborators', desc: 'Send email invites with role-based permissions — owners, editors, commenters, or viewers.' },
                  { step: 'Step 3', icon: '🎛️', title: 'Co-create in real-time', desc: "See who's editing, leave comments on specific regions, and merge contributions seamlessly." },
                ].map(({ step, icon, title, desc }) => (
                  <div key={step} className="collab-step-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="collab-step-icon-wrap">{icon}</div>
                      <div>
                        <div className="collab-step-number">{step}</div>
                        <div className="collab-step-title">{title}</div>
                      </div>
                    </div>
                    <p className="collab-step-desc">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
}

export default Collaboration

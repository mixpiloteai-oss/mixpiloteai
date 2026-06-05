import './admin.css'
import { useState } from 'react'

type ContentType = 'upload' | 'comment' | 'chat' | 'profile'
type ModerationStatus = 'pending' | 'approved' | 'rejected'

interface ContentItem {
  id: string
  type: ContentType
  title: string
  author: string
  preview: string
  flags: string[]
  score: number
  submittedAt: string
  status: ModerationStatus
  autoFlagged: boolean
}

interface ModerationLog {
  id: number
  action: 'approved' | 'rejected' | 'flagged'
  content: string
  moderator: string
  reason: string
  time: string
}

const QUEUE: ContentItem[] = [
  { id: 'c-001', type: 'upload',  title: 'Dark Industrial Kicks Extreme Vol.3', author: 'industrial_mind', preview: '2.1 GB audio pack — 840 samples', flags: ['copyright'], score: 72, submittedAt: '2026-05-19 07:30', status: 'pending', autoFlagged: true },
  { id: 'c-002', type: 'comment', title: 'Comment on "SynthWave Pack"',          author: 'user_94712',     preview: 'This is garbage, [profanity removed] pathetic creator', flags: ['toxic', 'profanity'], score: 90, submittedAt: '2026-05-19 08:41', status: 'pending', autoFlagged: true },
  { id: 'c-003', type: 'upload',  title: 'Minimal Techno Preset Bundle',         author: 'dark_collective', preview: '480 MB — 120 presets for Vital, Serum', flags: [], score: 12, submittedAt: '2026-05-18 22:10', status: 'pending', autoFlagged: false },
  { id: 'c-004', type: 'profile', title: 'Profile update: Devon Blake',          author: 'devon_blake',    preview: 'Bio contains external payment link (paypal.me/...)', flags: ['external_link'], score: 65, submittedAt: '2026-05-18 20:00', status: 'pending', autoFlagged: true },
  { id: 'c-005', type: 'chat',    title: 'Collab chat message',                  author: 'user_29031',     preview: 'Check this out: bit.ly/xxxxx (shortened URL)', flags: ['suspicious_link'], score: 58, submittedAt: '2026-05-18 15:22', status: 'pending', autoFlagged: true },
  { id: 'c-006', type: 'upload',  title: 'Future Bass Chords Essential',         author: 'synthmaster',    preview: '1.2 GB — 200 chord stabs and progressions', flags: [], score: 8, submittedAt: '2026-05-18 14:00', status: 'pending', autoFlagged: false },
]

const LOG: ModerationLog[] = [
  { id: 1, action: 'rejected', content: 'Comment by user_88412',         moderator: 'auto-mod',            reason: 'Hate speech — score 96', time: '2026-05-19 09:01' },
  { id: 2, action: 'approved', content: 'Upload: Lo-fi Chillhop Vol.2',  moderator: 'mod@neurotek.ai',     reason: 'Manual review passed',    time: '2026-05-19 08:55' },
  { id: 3, action: 'flagged',  content: 'Profile: user_72441',           moderator: 'auto-mod',            reason: 'External payment link',   time: '2026-05-18 23:12' },
  { id: 4, action: 'approved', content: 'Upload: Trap Drum Kit 808',     moderator: 'admin@neurotek.ai',   reason: 'Manual review passed',    time: '2026-05-18 20:30' },
  { id: 5, action: 'rejected', content: 'Upload: Unauthorized Sample Pack', moderator: 'mod@neurotek.ai',  reason: 'Copyright claim verified', time: '2026-05-18 18:00' },
  { id: 6, action: 'approved', content: 'Upload: Minimal Techno Pack v1', moderator: 'auto-mod',           reason: 'Auto-approved (score < 20)', time: '2026-05-18 14:30' },
]

const TYPE_COLORS: Record<ContentType, string> = {
  upload: 'badge-purple', comment: 'badge-orange', chat: 'badge-cyan', profile: 'badge-grey',
}

const LOG_COLORS: Record<string, string> = {
  approved: 'badge-green', rejected: 'badge-red', flagged: 'badge-orange',
}

const AUTO_RULES = [
  { rule: 'Auto-approve score < 20', enabled: true,  threshold: 20 },
  { rule: 'Auto-reject score > 85',  enabled: true,  threshold: 85 },
  { rule: 'Flag external links',     enabled: true,  threshold: 0 },
  { rule: 'Flag copyright keywords', enabled: true,  threshold: 0 },
  { rule: 'Flag profanity',          enabled: true,  threshold: 0 },
  { rule: 'Flag toxic language',     enabled: false, threshold: 0 },
]

export default function Moderation() {
  const [tab, setTab]         = useState<'queue' | 'log' | 'automod'>('queue')
  const [typeFilter, setTypeFilter] = useState<'all' | ContentType>('all')
  const [items, setItems]     = useState(QUEUE)
  const [rules, setRules]     = useState(AUTO_RULES)

  const visible = typeFilter === 'all' ? items.filter(i => i.status === 'pending') : items.filter(i => i.status === 'pending' && i.type === typeFilter)
  const pendingCount = items.filter(i => i.status === 'pending').length

  function moderate(id: string, action: 'approved' | 'rejected') {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: action } : i))
  }

  function toggleRule(idx: number) {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r))
  }

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Moderation</div>
          <div className="admin-page-sub">{pendingCount} items pending review</div>
        </div>
        <div className="admin-badge badge-orange" style={{ fontSize: 12, padding: '6px 14px' }}>
          {pendingCount} Pending
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1a1a2e' }}>
        {(['queue', 'log', 'automod'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'none', borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === t ? '#8b5cf6' : '#475569', transition: 'all 0.15s', marginBottom: -1,
            }}>
            {t === 'queue' ? `Queue (${pendingCount})` : t === 'log' ? 'Moderation Log' : 'Auto-Mod Rules'}
          </button>
        ))}
      </div>

      {/* Queue */}
      {tab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'upload', 'comment', 'chat', 'profile'] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`admin-btn admin-btn-sm ${typeFilter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="admin-card admin-card-glow">
              <div className="admin-card-body" style={{ textAlign: 'center', padding: '60px 20px', color: '#334155' }}>
                ✓ No pending items in this category
              </div>
            </div>
          )}
          {visible.map(item => (
            <div key={item.id} className="admin-card admin-card-glow">
              <div className="admin-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span className={`admin-badge ${TYPE_COLORS[item.type]}`} style={{ fontSize: 10 }}>{item.type}</span>
                      {item.autoFlagged && <span className="admin-badge badge-red" style={{ fontSize: 10 }}>Auto-flagged</span>}
                      {item.flags.map(f => (
                        <span key={f} className="admin-badge badge-orange" style={{ fontSize: 10 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>by {item.author} · {item.submittedAt}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: item.score > 70 ? '#ef4444' : item.score > 40 ? '#f59e0b' : '#10b981' }}>
                      {item.score}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155' }}>Risk Score</div>
                  </div>
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a2e',
                  fontSize: 13, color: '#64748b', fontStyle: 'italic',
                }}>
                  {item.preview}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => moderate(item.id, 'approved')}>
                    ✓ Approve
                  </button>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => moderate(item.id, 'rejected')}>
                    ✗ Reject
                  </button>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm">
                    View Full
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      {tab === 'log' && (
        <div className="admin-card admin-card-glow">
          <table className="admin-table">
            <thead>
              <tr><th>Action</th><th>Content</th><th>Moderator</th><th>Reason</th><th>Time</th></tr>
            </thead>
            <tbody>
              {LOG.map(entry => (
                <tr key={entry.id}>
                  <td><span className={`admin-badge ${LOG_COLORS[entry.action]}`} style={{ fontSize: 11 }}>{entry.action}</span></td>
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{entry.content}</td>
                  <td style={{ fontSize: 11, color: '#475569' }}>{entry.moderator}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{entry.reason}</td>
                  <td style={{ fontSize: 11, color: '#334155' }}>{entry.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Auto-mod */}
      {tab === 'automod' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body" style={{ paddingBottom: 0 }}>
              <div className="admin-card-title">Automatic Moderation Rules</div>
            </div>
            {rules.map((rule, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderBottom: i < rules.length - 1 ? '1px solid #1a1a2e' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{rule.rule}</div>
                  {rule.threshold > 0 && (
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Threshold: {rule.threshold}</div>
                  )}
                </div>
                <button
                  onClick={() => toggleRule(i)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: rule.enabled ? '#8b5cf6' : '#1a1a2e',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9,
                    background: 'white', transition: 'left 0.2s',
                    left: rule.enabled ? 23 : 3,
                  }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="admin-btn admin-btn-primary admin-btn-sm">Save Rules</button>
          </div>
        </div>
      )}
    </div>
  )
}

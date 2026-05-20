import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../lib/api'
import './admin.css'

interface ManagedPlan {
  id: string; name: string; priceMonthly: number; priceYearly: number
  dailyAIRequests: number; maxProjects: number; maxPackUploads: number
  cloudSyncGB: number; features: string[]; model: string
  coachAccess: boolean; analyticsAccess: boolean; marketplaceAccess: boolean
  collaborationAccess: boolean; desktopAccess: boolean; learningMode: boolean
  active: boolean; trialDays: number; sortOrder: number; updatedAt: string
}

interface SubEvent {
  id: number
  date: string
  userName: string
  eventType: 'created' | 'upgraded' | 'downgraded' | 'cancelled' | 'renewed'
  fromPlan: string
  toPlan: string
  amount: string
}

const EVENTS: SubEvent[] = [
  { id: 1, date: '2026-05-19', userName: 'Emery Nelson', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 2, date: '2026-05-19', userName: 'Quinn Torres', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 3, date: '2026-05-18', userName: 'Alex Rivera', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 4, date: '2026-05-18', userName: 'Harley White', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 5, date: '2026-05-17', userName: 'Morgan Chen', eventType: 'upgraded', fromPlan: 'Free', toPlan: 'Pro', amount: '$19.00' },
  { id: 6, date: '2026-05-17', userName: 'Blake Anderson', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 7, date: '2026-05-16', userName: 'Parker Wilson', eventType: 'downgraded', fromPlan: 'Pro', toPlan: 'Free', amount: '$0.00' },
  { id: 8, date: '2026-05-16', userName: 'Taylor Kim', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 9, date: '2026-05-15', userName: 'Skyler Davis', eventType: 'upgraded', fromPlan: 'Pro', toPlan: 'Studio', amount: '$49.00' },
  { id: 10, date: '2026-05-15', userName: 'Jamie Garcia', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 11, date: '2026-05-14', userName: 'Drew Martinez', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 12, date: '2026-05-13', userName: 'Robin Scott', eventType: 'cancelled', fromPlan: 'Free', toPlan: '—', amount: '$0.00' },
  { id: 13, date: '2026-05-12', userName: 'Finley Adams', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 14, date: '2026-05-11', userName: 'Jordan Lee', eventType: 'upgraded', fromPlan: 'Studio', toPlan: 'Label', amount: '$199.00' },
  { id: 15, date: '2026-05-10', userName: 'Sam Patel', eventType: 'renewed', fromPlan: 'Label', toPlan: 'Label', amount: '$199.00' },
]

const EVENT_BADGE: Record<SubEvent['eventType'], string> = {
  created: 'badge-green',
  upgraded: 'badge-cyan',
  downgraded: 'badge-orange',
  cancelled: 'badge-red',
  renewed: 'badge-purple',
}

const PLAN_BARS = [
  { name: 'Free', users: 4541, pct: 53.8, color: '#475569' },
  { name: 'Pro', users: 2847, pct: 33.8, color: '#8b5cf6' },
  { name: 'Studio', users: 891, pct: 10.6, color: '#22d3ee' },
  { name: 'Label', users: 153, pct: 1.8, color: '#f59e0b' },
]

const RENEWAL_DAYS = [
  { date: 'May 20', users: 42, revenue: '$1,248' },
  { date: 'May 21', users: 38, revenue: '$1,102' },
  { date: 'May 22', users: 55, revenue: '$1,895' },
  { date: 'May 23', users: 29, revenue: '$864' },
  { date: 'May 24', users: 61, revenue: '$2,140' },
  { date: 'May 25', users: 47, revenue: '$1,562' },
  { date: 'May 26', users: 33, revenue: '$980' },
]

const CANCEL_REASONS = [
  { reason: 'Too expensive', pct: 38, color: '#ef4444' },
  { reason: 'Missing features', pct: 24, color: '#f59e0b' },
  { reason: 'Not using it', pct: 19, color: '#8b5cf6' },
  { reason: 'Switching tools', pct: 12, color: '#22d3ee' },
  { reason: 'Other', pct: 7, color: '#475569' },
]

type SubTab = 'analytics' | 'plans'

export default function Subscriptions() {
  const [activeTab, setActiveTab] = useState<SubTab>('analytics')

  // Plans tab state
  const [plans, setPlans] = useState<ManagedPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<ManagedPlan>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function fetchPlans() {
    setPlansLoading(true)
    try {
      const res = await apiGet<{ success: boolean; data: ManagedPlan[] }>('/api/admin/plans')
      if (res.data) setPlans(res.data)
    } catch { /* silently fail */ }
    finally { setPlansLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'plans') fetchPlans()
  }, [activeTab])

  async function savePlan(id: string) {
    setSaving(true)
    setSaveMsg('')
    try {
      await apiPatch(`/api/admin/plans/${id}`, editDraft)
      setSaveMsg('✓ Sauvegardé')
      setEditingId(null)
      await fetchPlans()
    } catch (e: unknown) {
      setSaveMsg('✗ Erreur: ' + (e instanceof Error ? e.message : 'unknown'))
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function togglePlan(id: string, active: boolean) {
    try {
      await apiPatch(`/api/admin/plans/${id}/toggle`, { active })
      await fetchPlans()
    } catch { /* silently fail */ }
  }

  return (
    <div className="admin-fade-in" style={{ padding: '24px' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">Subscription Management</h1>
          <p className="admin-page-sub">Monitor plans, renewals, and churn</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="admin-tab-bar" style={{ marginBottom: 24 }}>
        <button
          className={`admin-tab-btn${activeTab === 'analytics' ? ' active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >Analytics</button>
        <button
          className={`admin-tab-btn${activeTab === 'plans' ? ' active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >Plans</button>
      </div>

      {/* ── Analytics tab ── */}
      {activeTab === 'analytics' && (
        <>
          <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
            <div className="admin-stat-card">
              <div className="admin-stat-value">3,891</div>
              <div className="admin-stat-label">Total Subscribers</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>$48,720</div>
              <div className="admin-stat-label">MRR</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value" style={{ color: 'var(--admin-orange)' }}>2.1%</div>
              <div className="admin-stat-label">Churn Rate</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">$284</div>
              <div className="admin-stat-label">Avg LTV</div>
            </div>
          </div>

          <div className="admin-grid-2" style={{ marginBottom: 24 }}>
            {/* Plan Breakdown */}
            <div className="admin-card">
              <div className="admin-card-body">
                <h3 className="admin-card-title">Plan Breakdown</h3>
                {PLAN_BARS.map(p => (
                  <div key={p.name} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: 'var(--admin-muted)' }}>{p.users.toLocaleString()} users · {p.pct}%</span>
                    </div>
                    <div className="admin-progress-track">
                      <div className="admin-progress-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancel Reasons */}
            <div className="admin-card">
              <div className="admin-card-body">
                <h3 className="admin-card-title">Cancellation Reasons</h3>
                {CANCEL_REASONS.map(r => (
                  <div key={r.reason} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <span>{r.reason}</span>
                      <span style={{ color: r.color, fontWeight: 700 }}>{r.pct}%</span>
                    </div>
                    <div className="admin-progress-track">
                      <div className="admin-progress-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Renewal Schedule */}
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <div className="admin-card-body">
              <h3 className="admin-card-title">Renewal Schedule (Next 7 Days)</h3>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {RENEWAL_DAYS.map(d => (
                  <div key={d.date} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 10, padding: '14px 18px', minWidth: 130, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>{d.date}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-purple)', marginBottom: 4 }}>{d.users}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 8 }}>renewals</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-green)' }}>{d.revenue}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Events Table */}
          <div className="admin-card">
            <div className="admin-card-body">
              <h3 className="admin-card-title">Recent Subscription Events</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>User</th>
                      <th>Event</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EVENTS.map(ev => (
                      <tr key={ev.id}>
                        <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{ev.date}</td>
                        <td style={{ fontSize: 13, fontWeight: 500 }}>{ev.userName}</td>
                        <td><span className={`admin-badge ${EVENT_BADGE[ev.eventType]}`}>{ev.eventType}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{ev.fromPlan}</td>
                        <td style={{ fontSize: 13 }}>{ev.toPlan}</td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: ev.amount === '$0.00' ? 'var(--admin-muted)' : 'var(--admin-green)' }}>{ev.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Plans tab ── */}
      {activeTab === 'plans' && (
        <div>
          {plansLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-muted)' }}>
              Chargement des plans...
            </div>
          )}

          {!plansLoading && plans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-muted)' }}>
              Aucun plan trouvé. L'API admin est peut-être indisponible.
            </div>
          )}

          {plans.map(plan => (
            <div key={plan.id} className={`admin-plan-card${!plan.active ? ' inactive' : ''}`}>
              {/* Header row */}
              <div className="admin-plan-header">
                <div className="admin-plan-name">
                  <span className="admin-plan-id">{plan.id}</span>
                  <span className={`admin-badge ${plan.active ? 'badge-green' : 'badge-grey'}`}>
                    {plan.active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="admin-plan-actions">
                  <button
                    className="admin-btn-sm"
                    onClick={() => { setEditingId(plan.id); setEditDraft({ ...plan }) }}
                  >Modifier</button>
                  <button
                    className={`admin-btn-sm ${plan.active ? 'btn-danger-sm' : 'btn-success-sm'}`}
                    onClick={() => togglePlan(plan.id, !plan.active)}
                  >{plan.active ? 'Désactiver' : 'Activer'}</button>
                </div>
              </div>

              {/* Plan summary (view mode) */}
              {editingId !== plan.id && (
                <div className="admin-plan-summary">
                  <div className="admin-plan-prices">
                    <span>{plan.name}</span>
                    <span className="admin-plan-price">${plan.priceMonthly}/mo · ${plan.priceYearly}/yr</span>
                  </div>
                  <div className="admin-plan-limits">
                    <span>{plan.dailyAIRequests} AI/jour</span>
                    <span>{plan.maxProjects < 0 ? '∞' : plan.maxProjects} projets</span>
                    <span>{plan.cloudSyncGB}GB sync</span>
                    <span>{plan.trialDays > 0 ? `${plan.trialDays}j essai` : "Pas d'essai"}</span>
                    <span className={`admin-badge ${plan.coachAccess ? 'badge-purple' : 'badge-grey'}`}>Coach IA</span>
                    <span className={`admin-badge ${plan.collaborationAccess ? 'badge-cyan' : 'badge-grey'}`}>Collab</span>
                  </div>
                  <div className="admin-plan-features">
                    {plan.features.slice(0, 4).map((f, i) => <span key={i} className="admin-plan-feature">• {f}</span>)}
                    {plan.features.length > 4 && <span className="admin-plan-feature-more">+{plan.features.length - 4} autres</span>}
                  </div>
                </div>
              )}

              {/* Edit form (edit mode) */}
              {editingId === plan.id && (
                <div className="admin-plan-editor">
                  <div className="admin-plan-editor-grid">
                    {/* Name */}
                    <label className="admin-field-label">Nom de l'offre</label>
                    <input
                      className="admin-input"
                      value={editDraft.name ?? ''}
                      onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                    />

                    {/* Prices */}
                    <label className="admin-field-label">Prix mensuel ($)</label>
                    <input
                      type="number" step="0.01" className="admin-input"
                      value={editDraft.priceMonthly ?? 0}
                      onChange={e => setEditDraft(d => ({ ...d, priceMonthly: parseFloat(e.target.value) }))}
                    />

                    <label className="admin-field-label">Prix annuel ($/mois)</label>
                    <input
                      type="number" step="0.01" className="admin-input"
                      value={editDraft.priceYearly ?? 0}
                      onChange={e => setEditDraft(d => ({ ...d, priceYearly: parseFloat(e.target.value) }))}
                    />

                    {/* AI limits */}
                    <label className="admin-field-label">Requêtes IA / jour</label>
                    <input
                      type="number" className="admin-input"
                      value={editDraft.dailyAIRequests ?? 20}
                      onChange={e => setEditDraft(d => ({ ...d, dailyAIRequests: parseInt(e.target.value, 10) }))}
                    />

                    {/* Projects */}
                    <label className="admin-field-label">Projets max (-1 = illimité)</label>
                    <input
                      type="number" className="admin-input"
                      value={editDraft.maxProjects ?? 5}
                      onChange={e => setEditDraft(d => ({ ...d, maxProjects: parseInt(e.target.value, 10) }))}
                    />

                    {/* Cloud sync */}
                    <label className="admin-field-label">Cloud sync (GB)</label>
                    <input
                      type="number" step="0.5" className="admin-input"
                      value={editDraft.cloudSyncGB ?? 1}
                      onChange={e => setEditDraft(d => ({ ...d, cloudSyncGB: parseFloat(e.target.value) }))}
                    />

                    {/* Trial days */}
                    <label className="admin-field-label">Essai gratuit (jours)</label>
                    <input
                      type="number" className="admin-input"
                      value={editDraft.trialDays ?? 0}
                      onChange={e => setEditDraft(d => ({ ...d, trialDays: parseInt(e.target.value, 10) }))}
                    />

                    {/* AI model */}
                    <label className="admin-field-label">Modèle IA</label>
                    <select
                      className="admin-input"
                      value={editDraft.model ?? 'haiku'}
                      onChange={e => setEditDraft(d => ({ ...d, model: e.target.value as 'haiku' | 'sonnet' | 'opus' }))}
                    >
                      <option value="haiku">Haiku (fast)</option>
                      <option value="sonnet">Sonnet (balanced)</option>
                      <option value="opus">Opus (premium)</option>
                    </select>
                  </div>

                  {/* Feature toggles */}
                  <div className="admin-plan-toggles">
                    {[
                      { key: 'coachAccess', label: 'Coach IA' },
                      { key: 'analyticsAccess', label: 'Analytics' },
                      { key: 'marketplaceAccess', label: 'Marketplace' },
                      { key: 'collaborationAccess', label: 'Collaboration' },
                      { key: 'desktopAccess', label: 'Accès desktop' },
                      { key: 'learningMode', label: 'Mode apprentissage' },
                    ].map(({ key, label }) => (
                      <label key={key} className="admin-toggle-label">
                        <input
                          type="checkbox"
                          checked={Boolean(editDraft[key as keyof typeof editDraft])}
                          onChange={e => setEditDraft(d => ({ ...d, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  {/* Features list (textarea) */}
                  <label className="admin-field-label">Avantages (un par ligne)</label>
                  <textarea
                    className="admin-input admin-textarea"
                    rows={5}
                    value={(editDraft.features ?? []).join('\n')}
                    onChange={e => setEditDraft(d => ({ ...d, features: e.target.value.split('\n').filter(Boolean) }))}
                  />

                  {/* Save/Cancel */}
                  <div className="admin-plan-editor-actions">
                    <button
                      className="admin-btn admin-btn-primary"
                      onClick={() => savePlan(plan.id)}
                      disabled={saving}
                    >{saving ? 'Sauvegarde...' : 'Sauvegarder'}</button>
                    <button
                      className="admin-btn"
                      onClick={() => { setEditingId(null); setEditDraft({}) }}
                    >Annuler</button>
                    {saveMsg && <span className="admin-save-msg">{saveMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

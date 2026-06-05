import './admin.css'
import { useState } from 'react'

interface StorageCategory {
  label: string
  usedGB: number
  totalGB: number
  color: string
  files: number
  growth: string
}

interface StorageFile {
  name: string
  size: string
  owner: string
  category: string
  uploadedAt: string
  status: 'active' | 'flagged' | 'orphaned'
}

const CATEGORIES: StorageCategory[] = [
  { label: 'Audio Exports', usedGB: 45.2, totalGB: 100, color: '#8b5cf6', files: 8_420,  growth: '+2.1 GB/day' },
  { label: 'Uploads',       usedGB: 28.6, totalGB: 100, color: '#22d3ee', files: 12_340, growth: '+0.8 GB/day' },
  { label: 'Backups',       usedGB: 18.1, totalGB: 100, color: '#10b981', files: 340,    growth: '+0.3 GB/day' },
  { label: 'Logs',          usedGB: 4.4,  totalGB: 100, color: '#f59e0b', files: 2_100,  growth: '+0.1 GB/day' },
  { label: 'System',        usedGB: 3.1,  totalGB: 100, color: '#ef4444', files: 820,    growth: 'Stable' },
  { label: 'Other',         usedGB: 0.6,  totalGB: 100, color: '#475569', files: 92,     growth: 'Stable' },
]

const LARGE_FILES: StorageFile[] = [
  { name: 'dark_industrial_kicks_vol2.zip', size: '2.41 GB', owner: 'dark_collective', category: 'Uploads', uploadedAt: '2026-05-10', status: 'active' },
  { name: 'export_cameron_hall_mixdown_v8.wav', size: '1.84 GB', owner: 'cam.hall@music.co', category: 'Audio Exports', uploadedAt: '2026-05-19', status: 'active' },
  { name: 'backup_2026-05-01_full.tar.gz', size: '1.62 GB', owner: 'system', category: 'Backups', uploadedAt: '2026-05-01', status: 'active' },
  { name: 'synthmaster_omnipresence_pack.zip', size: '1.23 GB', owner: 'synthmaster', category: 'Uploads', uploadedAt: '2026-04-28', status: 'active' },
  { name: 'orphaned_export_proj_8812.wav', size: '0.98 GB', owner: 'unknown', category: 'Audio Exports', uploadedAt: '2026-03-15', status: 'orphaned' },
  { name: 'spam_upload_flagged_casey.zip', size: '0.87 GB', owner: 'casey.w@gmail.com', category: 'Uploads', uploadedAt: '2026-02-20', status: 'flagged' },
  { name: 'backup_2026-04-01_full.tar.gz', size: '1.55 GB', owner: 'system', category: 'Backups', uploadedAt: '2026-04-01', status: 'active' },
  { name: 'export_avery_brown_stems_all.zip', size: '0.72 GB', owner: 'avery.brown@beats.com', category: 'Audio Exports', uploadedAt: '2026-05-18', status: 'active' },
]

const totalUsed = CATEGORIES.reduce((s, c) => s + c.usedGB, 0)
const totalGB = 200
const usedPct = (totalUsed / totalGB) * 100

function Ring({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a2e" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color}
        fontSize={size < 60 ? 11 : 14} fontWeight="bold" fontFamily="monospace">
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

export default function Storage() {
  const [tab, setTab] = useState<'overview' | 'files' | 'cleanup'>('overview')
  const [fileFilter, setFileFilter] = useState<'all' | 'orphaned' | 'flagged'>('all')
  const [cleaning, setCleaning] = useState(false)
  const [cleaned, setCleaned] = useState(false)

  const visibleFiles = fileFilter === 'all' ? LARGE_FILES : LARGE_FILES.filter(f => f.status === fileFilter)

  function runCleanup() {
    setCleaning(true)
    setTimeout(() => { setCleaning(false); setCleaned(true) }, 2200)
  }

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Storage</div>
          <div className="admin-page-sub">{totalUsed.toFixed(1)} GB used of {totalGB} GB total</div>
        </div>
        <div className="admin-header-actions">
          <div className="admin-badge badge-orange" style={{ fontSize: 12, padding: '6px 14px' }}>
            {usedPct.toFixed(1)}% Used
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1a1a2e' }}>
        {(['overview', 'files', 'cleanup'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'none', borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === t ? '#8b5cf6' : '#475569', transition: 'all 0.15s', marginBottom: -1,
            }}>
            {t === 'overview' ? 'Overview' : t === 'files' ? 'Large Files' : 'Cleanup Tools'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Total ring + stat */}
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                <Ring pct={usedPct} color="#8b5cf6" size={120} />
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace', color: '#f1f5f9' }}>
                    {totalUsed.toFixed(1)} <span style={{ fontSize: 16, color: '#475569' }}>GB</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>of {totalGB} GB total capacity</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: '#10b981' }}>
                      {(totalGB - totalUsed).toFixed(1)} GB free
                    </div>
                    <div style={{ fontSize: 12, color: '#f59e0b' }}>
                      +3.3 GB/day growth
                    </div>
                    <div style={{ fontSize: 12, color: '#ef4444' }}>
                      Est. full in {Math.floor((totalGB - totalUsed) / 3.3)} days
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {CATEGORIES.map(cat => {
              const pct = (cat.usedGB / totalGB) * 100
              return (
                <div key={cat.label} className="admin-card admin-card-glow">
                  <div className="admin-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                          {cat.files.toLocaleString()} files
                        </div>
                      </div>
                      <Ring pct={pct} color={cat.color} size={52} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: cat.color }}>
                      {cat.usedGB} <span style={{ fontSize: 13, color: '#475569' }}>GB</span>
                    </div>
                    <div style={{ marginTop: 8, height: 3, background: '#1a1a2e', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{cat.growth}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Large Files */}
      {tab === 'files' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'orphaned', 'flagged'] as const).map(f => (
              <button key={f} onClick={() => setFileFilter(f)}
                className={`admin-btn admin-btn-sm ${fileFilter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
                {f === 'all' ? 'All' : f === 'orphaned' ? 'Orphaned' : 'Flagged'}
              </button>
            ))}
          </div>
          <div className="admin-card admin-card-glow">
            <table className="admin-table">
              <thead>
                <tr><th>File</th><th>Size</th><th>Owner</th><th>Category</th><th>Uploaded</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visibleFiles.map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22d3ee', fontSize: 12 }}>{f.size}</td>
                    <td style={{ fontSize: 11, color: '#475569' }}>{f.owner}</td>
                    <td><span className="admin-badge badge-grey" style={{ fontSize: 10 }}>{f.category}</span></td>
                    <td style={{ fontSize: 12, color: '#334155' }}>{f.uploadedAt}</td>
                    <td>
                      <span className={`admin-badge ${f.status === 'active' ? 'badge-green' : f.status === 'flagged' ? 'badge-red' : 'badge-orange'}`}
                        style={{ fontSize: 10 }}>
                        {f.status}
                      </span>
                    </td>
                    <td>
                      <button className="admin-btn admin-btn-ghost admin-btn-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cleanup Tools */}
      {tab === 'cleanup' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { label: 'Orphaned Files',    desc: 'Files with no associated user or project',  size: '0.98 GB', count: 23, safe: true },
            { label: 'Expired Exports',   desc: 'Export files older than 30 days',            size: '12.4 GB', count: 1820, safe: true },
            { label: 'Old Backups',       desc: 'Keep last 3, delete older backups',           size: '4.2 GB',  count: 12, safe: true },
            { label: 'Flagged Uploads',   desc: 'Content flagged for violations',              size: '1.2 GB',  count: 8,  safe: false },
            { label: 'Excess Log Files',  desc: 'Logs older than 90 days',                    size: '2.1 GB',  count: 4200, safe: true },
          ].map(item => (
            <div key={item.label} className="admin-card admin-card-glow">
              <div className="admin-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                    {item.label}
                    {!item.safe && <span className="admin-badge badge-red" style={{ fontSize: 10, marginLeft: 8 }}>Needs Review</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{item.desc}</div>
                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                    {item.count.toLocaleString()} files · {item.size} reclaimable
                  </div>
                </div>
                <button
                  className={`admin-btn admin-btn-sm ${item.safe ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                  onClick={item.safe ? runCleanup : undefined}
                  disabled={cleaning}
                >
                  {cleaning ? 'Running…' : 'Run Cleanup'}
                </button>
              </div>
            </div>
          ))}
          {cleaned && (
            <div className="admin-card" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: 20 }}>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                ✓ Cleanup complete — 2.3 GB reclaimed
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

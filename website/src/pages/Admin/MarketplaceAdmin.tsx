import './admin.css'
import { useState, useMemo } from 'react'

type ProductStatus = 'pending' | 'approved' | 'flagged'
type ProductCategory = 'Sample Pack' | 'Plugin' | 'Preset' | 'Loop Kit' | 'MIDI' | 'Template'

interface Product {
  id: number
  name: string
  creator: string
  category: ProductCategory
  price: number
  downloads: number
  submitted: string
  status: ProductStatus
  flagReason?: string
  description: string
  fileSize: string
  fileFormat: string
  tags: string[]
  copyright: string
  moderationHistory: string[]
  coverColor: string
  checked: boolean
}

const MOCK_PRODUCTS: Product[] = [
  { id: 1, name: 'Dark Trap Kit Vol.4', creator: 'BeatsByKaz', category: 'Sample Pack', price: 14.99, downloads: 0, submitted: '2026-05-19', status: 'pending', description: '150 dark trap samples, 808s, hi-hats, and percussion loops at 140 BPM.', fileSize: '245 MB', fileFormat: 'WAV/MP3', tags: ['trap', 'dark', '808', 'hi-hat'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-19'], coverColor: '#8b5cf6', checked: false },
  { id: 2, name: 'Lo-Fi Study Vibes', creator: 'ChillWaveStudio', category: 'Loop Kit', price: 9.99, downloads: 0, submitted: '2026-05-18', status: 'pending', description: 'Cozy lo-fi loops perfect for study music. 80 loops included.', fileSize: '120 MB', fileFormat: 'WAV', tags: ['lo-fi', 'chill', 'study', 'jazz'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-18'], coverColor: '#22d3ee', checked: false },
  { id: 3, name: 'Pro Reverb VST', creator: 'NeuralFX', category: 'Plugin', price: 49.99, downloads: 0, submitted: '2026-05-18', status: 'pending', description: 'Professional reverb plugin with 200+ presets and algorithmic engine.', fileSize: '88 MB', fileFormat: 'VST3/AU', tags: ['reverb', 'fx', 'pro', 'vst'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-18'], coverColor: '#10b981', checked: false },
  { id: 4, name: 'House Music Template', creator: 'DJMatrix', category: 'Template', price: 24.99, downloads: 0, submitted: '2026-05-17', status: 'pending', description: 'Complete house music DAW template with mixdown ready tracks.', fileSize: '56 MB', fileFormat: 'ALS/FLP', tags: ['house', 'template', 'edm'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-17'], coverColor: '#f59e0b', checked: false },
  { id: 5, name: 'Vocal Chop MIDI Pack', creator: 'MIDIMasters', category: 'MIDI', price: 7.99, downloads: 0, submitted: '2026-05-17', status: 'pending', description: '200 MIDI vocal chop patterns for modern pop production.', fileSize: '12 MB', fileFormat: 'MIDI', tags: ['vocal', 'chop', 'midi', 'pop'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-17'], coverColor: '#ef4444', checked: false },
  { id: 6, name: 'Serum Dubstep Presets', creator: 'WobbleMachine', category: 'Preset', price: 19.99, downloads: 0, submitted: '2026-05-16', status: 'pending', description: '150 high-quality dubstep and riddim presets for Xfer Serum.', fileSize: '8 MB', fileFormat: 'FXP', tags: ['dubstep', 'serum', 'riddim', 'wobble'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-16'], coverColor: '#8b5cf6', checked: false },
  { id: 7, name: 'Boom Bap Essentials', creator: 'OldSchoolBeats', category: 'Sample Pack', price: 12.99, downloads: 0, submitted: '2026-05-16', status: 'pending', description: 'Classic boom bap drum samples and breaks.', fileSize: '180 MB', fileFormat: 'WAV', tags: ['boom bap', 'hip-hop', 'drums'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-16'], coverColor: '#22d3ee', checked: false },
  { id: 8, name: 'Cinematic Strings Library', creator: 'OrchestraFX', category: 'Sample Pack', price: 89.99, downloads: 0, submitted: '2026-05-15', status: 'pending', description: 'Professional orchestral string samples recorded in 96kHz.', fileSize: '1.2 GB', fileFormat: 'WAV', tags: ['cinematic', 'strings', 'orchestra'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-15'], coverColor: '#10b981', checked: false },
  { id: 9, name: 'Future Bass Synths', creator: 'SynthWave99', category: 'Preset', price: 16.99, downloads: 0, submitted: '2026-05-15', status: 'pending', description: '100 future bass synth presets for Sylenth1.', fileSize: '5 MB', fileFormat: 'FXB', tags: ['future bass', 'synth', 'sylenth1'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-15'], coverColor: '#f59e0b', checked: false },
  { id: 10, name: 'Acoustic Guitar Loops', creator: 'GuitarStudio', category: 'Loop Kit', price: 11.99, downloads: 0, submitted: '2026-05-14', status: 'pending', description: '60 acoustic guitar loops in various keys and tempos.', fileSize: '95 MB', fileFormat: 'WAV', tags: ['acoustic', 'guitar', 'loops'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-14'], coverColor: '#ef4444', checked: false },
  { id: 11, name: 'Neo Soul Samples', creator: 'SoulGrooves', category: 'Sample Pack', price: 13.99, downloads: 0, submitted: '2026-05-14', status: 'pending', description: 'Neo soul and R&B samples with warm analog character.', fileSize: '210 MB', fileFormat: 'WAV', tags: ['neo soul', 'r&b', 'analog'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-14'], coverColor: '#8b5cf6', checked: false },
  { id: 12, name: 'EDM Drop Builder', creator: 'DropKings', category: 'Template', price: 29.99, downloads: 0, submitted: '2026-05-13', status: 'pending', description: 'Complete EDM drop template with all stems and FX chains.', fileSize: '340 MB', fileFormat: 'ALS', tags: ['edm', 'drop', 'template'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-13'], coverColor: '#22d3ee', checked: false },
  { id: 13, name: 'Afrobeat Percussion Pack', creator: 'AfroRhythms', category: 'Sample Pack', price: 15.99, downloads: 0, submitted: '2026-05-13', status: 'pending', description: 'Authentic afrobeat percussion loops and one-shots.', fileSize: '165 MB', fileFormat: 'WAV', tags: ['afrobeat', 'percussion', 'african'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-13'], coverColor: '#10b981', checked: false },
  { id: 14, name: 'Minimal Techno Kit', creator: 'TechnoLab', category: 'Sample Pack', price: 10.99, downloads: 0, submitted: '2026-05-12', status: 'pending', description: 'Industrial minimal techno samples and sequences.', fileSize: '140 MB', fileFormat: 'WAV', tags: ['techno', 'minimal', 'industrial'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-12'], coverColor: '#f59e0b', checked: false },
  { id: 15, name: 'Jazz Piano Chords MIDI', creator: 'JazzMIDI', category: 'MIDI', price: 8.99, downloads: 0, submitted: '2026-05-12', status: 'pending', description: '180 jazz piano chord progressions in MIDI format.', fileSize: '3 MB', fileFormat: 'MIDI', tags: ['jazz', 'piano', 'chords', 'midi'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-12'], coverColor: '#ef4444', checked: false },
  { id: 16, name: 'Reggaeton Beats Vol.1', creator: 'LatinBeatz', category: 'Loop Kit', price: 17.99, downloads: 0, submitted: '2026-05-12', status: 'pending', description: 'Full reggaeton beat loops ready for mixing.', fileSize: '200 MB', fileFormat: 'WAV/MP3', tags: ['reggaeton', 'latin', 'beats'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-12'], coverColor: '#8b5cf6', checked: false },
  { id: 17, name: 'Ambient Space Pads', creator: 'SpaceSounds', category: 'Sample Pack', price: 12.99, downloads: 0, submitted: '2026-05-11', status: 'pending', description: 'Ethereal ambient pad textures for cinematic music.', fileSize: '290 MB', fileFormat: 'WAV', tags: ['ambient', 'space', 'pads', 'cinematic'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-11'], coverColor: '#22d3ee', checked: false },
  { id: 18, name: 'UK Drill Drums', creator: 'DrillMaster', category: 'Sample Pack', price: 13.99, downloads: 0, submitted: '2026-05-11', status: 'pending', description: 'UK drill drum patterns and one-shots, 140 BPM.', fileSize: '155 MB', fileFormat: 'WAV', tags: ['drill', 'uk', 'drums', 'hip-hop'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-11'], coverColor: '#10b981', checked: false },
  // Approved
  { id: 19, name: 'Trap Kit Vol.3', creator: 'BeatsByKaz', category: 'Sample Pack', price: 12.99, downloads: 4520, submitted: '2026-04-20', status: 'approved', description: 'Previous volume of the dark trap kit series.', fileSize: '220 MB', fileFormat: 'WAV', tags: ['trap', '808'], copyright: 'Original work', moderationHistory: ['Submitted 2026-04-20', 'Approved 2026-04-21'], coverColor: '#8b5cf6', checked: false },
  { id: 20, name: 'Lo-Fi Presets', creator: 'ChillWaveStudio', category: 'Preset', price: 8.00, downloads: 2890, submitted: '2026-04-15', status: 'approved', description: 'Lo-fi synth presets for Vital.', fileSize: '4 MB', fileFormat: 'FXP', tags: ['lo-fi', 'vital'], copyright: 'Original work', moderationHistory: ['Submitted 2026-04-15', 'Approved 2026-04-16'], coverColor: '#22d3ee', checked: false },
  { id: 21, name: 'Synth Samples Pack', creator: 'SynthWave99', category: 'Sample Pack', price: 24.00, downloads: 1240, submitted: '2026-04-10', status: 'approved', description: 'Analog synth one-shots and textures.', fileSize: '310 MB', fileFormat: 'WAV', tags: ['synth', 'analog'], copyright: 'Original work', moderationHistory: ['Submitted 2026-04-10', 'Approved 2026-04-11'], coverColor: '#10b981', checked: false },
  // Flagged
  { id: 22, name: 'Famous Song Replicas', creator: 'CopyUser99', category: 'Sample Pack', price: 5.99, downloads: 120, submitted: '2026-05-10', status: 'flagged', flagReason: 'Copyright issue', description: 'Replicas of famous songs.', fileSize: '90 MB', fileFormat: 'WAV', tags: ['remix', 'replica'], copyright: 'Unclear', moderationHistory: ['Submitted 2026-05-10', 'Flagged 2026-05-11 — Copyright issue'], coverColor: '#ef4444', checked: false },
  { id: 23, name: 'Low Quality Beats', creator: 'RandomUser', category: 'Loop Kit', price: 2.99, downloads: 45, submitted: '2026-05-08', status: 'flagged', flagReason: 'Low quality', description: 'Random loops.', fileSize: '10 MB', fileFormat: 'MP3', tags: ['beats'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-08', 'Flagged 2026-05-09 — Low quality'], coverColor: '#f59e0b', checked: false },
  { id: 24, name: 'Inappropriate Sample Kit', creator: 'BadActor', category: 'Sample Pack', price: 0.99, downloads: 230, submitted: '2026-05-05', status: 'flagged', flagReason: 'Inappropriate content', description: 'Contains offensive material.', fileSize: '50 MB', fileFormat: 'WAV', tags: ['samples'], copyright: 'Unknown', moderationHistory: ['Submitted 2026-05-05', 'Flagged 2026-05-06 — Inappropriate content'], coverColor: '#ef4444', checked: false },
  { id: 25, name: 'Duplicate Drum Kit', creator: 'SameOldBeats', category: 'Sample Pack', price: 9.99, downloads: 80, submitted: '2026-05-03', status: 'flagged', flagReason: 'Duplicate content', description: 'Copy of existing product.', fileSize: '180 MB', fileFormat: 'WAV', tags: ['drums'], copyright: 'Original work', moderationHistory: ['Submitted 2026-05-03', 'Flagged 2026-05-04 — Duplicate content'], coverColor: '#475569', checked: false },
]

type TabKey = 'pending' | 'approved' | 'flagged' | 'all'

const CATEGORY_BADGE: Record<ProductCategory, string> = {
  'Sample Pack': 'badge-purple',
  'Plugin': 'badge-cyan',
  'Preset': 'badge-orange',
  'Loop Kit': 'badge-green',
  'MIDI': 'badge-grey',
  'Template': 'badge-red',
}

interface RejectModal {
  productId: number
  productName: string
}
interface DetailModal {
  product: Product
}

export default function MarketplaceAdmin() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [rejectModal, setRejectModal] = useState<RejectModal | null>(null)
  const [rejectReason, setRejectReason] = useState('Low quality')
  const [detailModal, setDetailModal] = useState<DetailModal | null>(null)

  const pendingCount = products.filter(p => p.status === 'pending').length
  const flaggedCount = products.filter(p => p.status === 'flagged').length

  const tabProducts = useMemo(() => {
    if (activeTab === 'all') return products
    return products.filter(p => p.status === activeTab)
  }, [products, activeTab])

  const checkedIds = products.filter(p => p.checked && p.status === activeTab).map(p => p.id)

  const toggleCheck = (id: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, checked: !p.checked } : p))
  }

  const handleApprove = (id: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', checked: false } : p))
  }

  const handleRejectConfirm = () => {
    if (!rejectModal) return
    setProducts(prev => prev.map(p => p.id === rejectModal.productId ? { ...p, status: 'flagged', flagReason: rejectReason, checked: false } : p))
    setRejectModal(null)
  }

  const handleFlag = (id: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'flagged', flagReason: 'Manually flagged', checked: false } : p))
  }

  const handleClearFlag = (id: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', flagReason: undefined, checked: false } : p))
  }

  const handleDelete = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const bulkApprove = () => {
    setProducts(prev => prev.map(p => checkedIds.includes(p.id) ? { ...p, status: 'approved', checked: false } : p))
  }

  const bulkDelete = () => {
    setProducts(prev => prev.filter(p => !checkedIds.includes(p.id)))
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending Review', count: pendingCount },
    { key: 'approved', label: 'Approved' },
    { key: 'flagged', label: 'Flagged', count: flaggedCount },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="admin-fade-in" style={{ padding: '24px' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">Marketplace Moderation</h1>
          <p className="admin-page-sub">Review, approve, and manage marketplace products</p>
        </div>
      </div>

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-value">842</div>
          <div className="admin-stat-label">Total Products</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-orange)' }}>{pendingCount}</div>
          <div className="admin-stat-label">Pending Review</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-red)' }}>{flaggedCount}</div>
          <div className="admin-stat-label">Flagged</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">42,890</div>
          <div className="admin-stat-label">This Month Downloads</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--admin-border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--admin-purple)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--admin-text)' : 'var(--admin-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t.key ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.label}
            {t.count !== undefined && <span style={{ background: 'var(--admin-purple)', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {checkedIds.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{checkedIds.length} selected</span>
          {activeTab === 'pending' && <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={bulkApprove}>Bulk Approve</button>}
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setProducts(prev => prev.map(p => ({ ...p, checked: false })))}>Clear Selection</button>
          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={bulkDelete}>Bulk Delete</button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-body">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Product</th>
                  <th>Creator</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Downloads</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tabProducts.map(product => (
                  <tr key={product.id}>
                    <td>
                      <input type="checkbox" checked={product.checked} onChange={() => toggleCheck(product.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: product.coverColor, flexShrink: 0 }} />
                        <button
                          onClick={() => setDetailModal({ product })}
                          style={{ background: 'none', border: 'none', color: 'var(--admin-cyan)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, textAlign: 'left' }}
                        >
                          {product.name}
                        </button>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{product.creator}</td>
                    <td><span className={`admin-badge ${CATEGORY_BADGE[product.category]}`}>{product.category}</span></td>
                    <td style={{ fontSize: 13 }}>${product.price.toFixed(2)}</td>
                    <td style={{ fontSize: 13 }}>{product.downloads.toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{product.submitted}</td>
                    <td>
                      {product.status === 'pending' && <span className="admin-badge badge-orange">Pending</span>}
                      {product.status === 'approved' && <span className="admin-badge badge-green">Approved</span>}
                      {product.status === 'flagged' && <span className="admin-badge badge-red">Flagged</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {product.status === 'pending' && <>
                          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleApprove(product.id)}>✓ Approve</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setRejectModal({ productId: product.id, productName: product.name })}>✗ Reject</button>
                        </>}
                        {product.status === 'approved' && <>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleFlag(product.id)}>Flag</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(product.id)}>Delete</button>
                        </>}
                        {product.status === 'flagged' && <>
                          <div style={{ fontSize: 11, color: 'var(--admin-orange)', marginRight: 4 }}>{product.flagReason}</div>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleClearFlag(product.id)}>Clear Flag</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(product.id)}>Delete</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: 440, padding: 0 }}>
            <div className="admin-card-body">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-red)' }}>Reject Product</h3>
              <p style={{ fontSize: 13, color: 'var(--admin-muted)', marginBottom: 16 }}>{rejectModal.productName}</p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Rejection Reason</label>
                <select className="admin-select" style={{ width: '100%' }} value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option>Copyright issue</option>
                  <option>Low quality</option>
                  <option>Inappropriate content</option>
                  <option>Missing metadata</option>
                  <option>Duplicate content</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
                <button className="admin-btn admin-btn-danger" onClick={handleRejectConfirm}>Reject Product</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: 560, maxHeight: '80vh', overflowY: 'auto', padding: 0 }}>
            <div className="admin-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="admin-card-title">{detailModal.product.name}</h3>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDetailModal(null)}>✕</button>
              </div>
              <div style={{ width: '100%', height: 120, background: `linear-gradient(135deg, ${detailModal.product.coverColor}44, ${detailModal.product.coverColor}22)`, border: `1px solid ${detailModal.product.coverColor}44`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--admin-muted)', fontSize: 13 }}>
                Preview Placeholder
              </div>
              <p style={{ fontSize: 13, color: 'var(--admin-muted)', marginBottom: 16 }}>{detailModal.product.description}</p>
              <div className="admin-grid-2" style={{ marginBottom: 16 }}>
                {[
                  ['Creator', detailModal.product.creator],
                  ['Category', detailModal.product.category],
                  ['Price', `$${detailModal.product.price.toFixed(2)}`],
                  ['File Size', detailModal.product.fileSize],
                  ['Format', detailModal.product.fileFormat],
                  ['Copyright', detailModal.product.copyright],
                ].map(([k, v], i) => (
                  <div key={i} style={{ background: 'var(--admin-card)', borderRadius: 6, padding: '8px 10px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>{k}</div>
                    <div style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 6 }}>Tags</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {detailModal.product.tags.map(t => <span key={t} className="admin-badge badge-grey">{t}</span>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>Moderation History</div>
                {detailModal.product.moderationHistory.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}>
                    <span style={{ color: 'var(--admin-muted)', marginRight: 8 }}>•</span>{h}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

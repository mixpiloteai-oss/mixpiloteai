import { useState, useEffect } from 'react'
import { apiGet, apiPatch } from '../../lib/api'
import './admin.css'

// ── TypeScript interfaces ────────────────────────────────────────────────────

interface HeroSection {
  badge: string
  titleLine1: string
  titleHighlight: string
  subtitle: string
  cta1Text: string
  cta1Url: string
  cta2Text: string
  socialProof: string
  guideLink: string
}

interface LogosSection {
  label: string
  items: string[]
}

interface StatItem {
  val: string
  label: string
}

interface FeatureItem {
  icon: string
  title: string
  desc: string
  accent: string
}

interface FeaturesSection {
  eyebrow: string
  title: string
  highlight: string
  desc: string
  items: FeatureItem[]
}

interface StepItem {
  num: string
  title: string
  desc: string
}

interface HowSection {
  eyebrow: string
  title: string
  highlight: string
  items: StepItem[]
}

interface CompareRow {
  feature: string
  nt: string
  trad: string
}

interface CompareSection {
  eyebrow: string
  title: string
  highlight: string
  rows: CompareRow[]
}

interface PricingSection {
  eyebrow: string
  title: string
  highlight: string
  desc: string
}

interface CtaSection {
  title: string
  highlight: string
  subtitle: string
  cta1Text: string
  cta1Url: string
  cta2Text: string
  cta2Url: string
}

type CmsTab = 'hero' | 'logos' | 'stats' | 'features' | 'how' | 'compare' | 'pricing' | 'cta'

const TABS: { id: CmsTab; label: string }[] = [
  { id: 'hero',     label: 'Hero' },
  { id: 'logos',    label: 'Logos' },
  { id: 'stats',    label: 'Stats' },
  { id: 'features', label: 'Features' },
  { id: 'how',      label: 'How It Works' },
  { id: 'compare',  label: 'Compare' },
  { id: 'pricing',  label: 'Pricing' },
  { id: 'cta',      label: 'CTA' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--nt-text-muted)', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CMS() {
  const [activeTab, setActiveTab] = useState<CmsTab>('hero')
  const [content, setContent] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    apiGet<{ success: boolean; data: Record<string, unknown> }>('/api/admin/cms')
      .then(res => { if (res.data) setContent(res.data) })
      .catch(() => {})
  }, [])

  async function save(section: string, updates: unknown) {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await apiPatch<{ success: boolean; data: unknown }>(`/api/admin/cms/${section}`, updates)
      setContent(prev => ({ ...prev, [section]: res.data }))
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Error saving.')
    } finally {
      setSaving(false)
    }
  }

  function getSection<T>(key: CmsTab): T {
    return (content[key] ?? {}) as T
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="admin-section-title" style={{ marginBottom: 6 }}>Landing Page CMS</h1>
        <p style={{ fontSize: 13, color: 'var(--nt-text-muted)' }}>
          Edit the public landing page content. Changes are saved instantly and appear on the site within 5 minutes (or on next page load).
        </p>
      </div>

      <div className="cms-section-note">
        Changes appear on the public site within 5 minutes (or on next page load).
      </div>

      {/* Tab bar */}
      <div className="admin-tab-bar" style={{ marginBottom: 28 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Hero ── */}
      {activeTab === 'hero' && (
        <HeroEditor
          data={getSection<HeroSection>('hero')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('hero', d)}
        />
      )}

      {/* ── Logos ── */}
      {activeTab === 'logos' && (
        <LogosEditor
          data={getSection<LogosSection>('logos')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('logos', d)}
        />
      )}

      {/* ── Stats ── */}
      {activeTab === 'stats' && (
        <StatsEditor
          data={Array.isArray(content['stats']) ? (content['stats'] as StatItem[]) : []}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('stats', d)}
        />
      )}

      {/* ── Features ── */}
      {activeTab === 'features' && (
        <FeaturesEditor
          data={getSection<FeaturesSection>('features')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('features', d)}
        />
      )}

      {/* ── How ── */}
      {activeTab === 'how' && (
        <HowEditor
          data={getSection<HowSection>('how')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('how', d)}
        />
      )}

      {/* ── Compare ── */}
      {activeTab === 'compare' && (
        <CompareEditor
          data={getSection<CompareSection>('compare')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('compare', d)}
        />
      )}

      {/* ── Pricing ── */}
      {activeTab === 'pricing' && (
        <PricingEditor
          data={getSection<PricingSection>('pricing')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('pricing', d)}
        />
      )}

      {/* ── CTA ── */}
      {activeTab === 'cta' && (
        <CtaEditor
          data={getSection<CtaSection>('cta')}
          saving={saving}
          saveMsg={saveMsg}
          onSave={d => save('cta', d)}
        />
      )}
    </div>
  )
}

// ── Section Editors ──────────────────────────────────────────────────────────

function SaveBar({ saving, saveMsg, onSave }: { saving: boolean; saveMsg: string; onSave: () => void }) {
  return (
    <div className="cms-save-bar">
      <button
        className="admin-btn admin-btn-primary"
        disabled={saving}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      {saveMsg && (
        <span className={`cms-save-msg${saveMsg.startsWith('Error') ? ' error' : ''}`}>
          {saveMsg}
        </span>
      )}
    </div>
  )
}

// Hero
function HeroEditor({ data, saving, saveMsg, onSave }: {
  data: HeroSection
  saving: boolean
  saveMsg: string
  onSave: (d: HeroSection) => void
}) {
  const defaults: HeroSection = { badge: '', titleLine1: '', titleHighlight: '', subtitle: '', cta1Text: '', cta1Url: '', cta2Text: '', socialProof: '', guideLink: '' }
  const [form, setForm] = useState<HeroSection>({ ...defaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const set = (k: keyof HeroSection, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Field label="Badge text">
          <input className="admin-input" value={form.badge} onChange={e => set('badge', e.target.value)} />
        </Field>
        <Field label="Social proof text">
          <input className="admin-input" value={form.socialProof} onChange={e => set('socialProof', e.target.value)} />
        </Field>
        <Field label="Title line 1">
          <input className="admin-input" value={form.titleLine1} onChange={e => set('titleLine1', e.target.value)} />
        </Field>
        <Field label="Title highlight word">
          <input className="admin-input" value={form.titleHighlight} onChange={e => set('titleHighlight', e.target.value)} />
        </Field>
        <Field label="CTA 1 text">
          <input className="admin-input" value={form.cta1Text} onChange={e => set('cta1Text', e.target.value)} />
        </Field>
        <Field label="CTA 1 URL">
          <input className="admin-input" value={form.cta1Url} onChange={e => set('cta1Url', e.target.value)} />
        </Field>
        <Field label="CTA 2 text">
          <input className="admin-input" value={form.cta2Text} onChange={e => set('cta2Text', e.target.value)} />
        </Field>
        <Field label="Guide link text">
          <input className="admin-input" value={form.guideLink} onChange={e => set('guideLink', e.target.value)} />
        </Field>
      </div>
      <Field label="Subtitle">
        <textarea className="admin-input" rows={3} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

// Logos
function LogosEditor({ data, saving, saveMsg, onSave }: {
  data: LogosSection
  saving: boolean
  saveMsg: string
  onSave: (d: LogosSection) => void
}) {
  const [label, setLabel] = useState(data.label ?? '')
  const [itemsText, setItemsText] = useState((data.items ?? []).join('\n'))
  useEffect(() => {
    setLabel(data.label ?? '')
    setItemsText((data.items ?? []).join('\n'))
  }, [data])

  function handleSave() {
    onSave({ label, items: itemsText.split('\n').map(s => s.trim()).filter(Boolean) })
  }

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <Field label="Label text">
        <input className="admin-input" value={label} onChange={e => setLabel(e.target.value)} />
      </Field>
      <Field label="Logo items (one per line)">
        <textarea
          className="admin-input"
          rows={8}
          value={itemsText}
          onChange={e => setItemsText(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
        />
      </Field>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={handleSave} />
    </div>
  )
}

// Stats
function StatsEditor({ data, saving, saveMsg, onSave }: {
  data: StatItem[]
  saving: boolean
  saveMsg: string
  onSave: (d: StatItem[]) => void
}) {
  const defaultStats: StatItem[] = [
    { val: '12,400+', label: 'Producers' },
    { val: '2.4M',    label: 'Projects Created' },
    { val: '98%',     label: 'Uptime SLA' },
    { val: '< 50 ms', label: 'AI Latency' },
  ]
  const [items, setItems] = useState<StatItem[]>(data.length ? data : defaultStats)
  useEffect(() => { if (data.length) setItems(data) }, [data])

  const update = (i: number, k: keyof StatItem, v: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  const add = () => setItems(prev => [...prev, { val: '', label: '' }])
  const remove = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      {items.map((item, i) => (
        <div key={i} className="cms-list-item">
          <div style={{ flex: '0 0 140px' }}>
            <Field label="Value">
              <input className="admin-input" value={item.val} onChange={e => update(i, 'val', e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Label">
              <input className="admin-input" value={item.label} onChange={e => update(i, 'label', e.target.value)} />
            </Field>
          </div>
          <button className="admin-btn" style={{ marginTop: 22 }} onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button className="cms-add-btn" onClick={add}>+ Add stat</button>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(items)} />
    </div>
  )
}

// Features
function FeaturesEditor({ data, saving, saveMsg, onSave }: {
  data: FeaturesSection
  saving: boolean
  saveMsg: string
  onSave: (d: FeaturesSection) => void
}) {
  const featureDefaults: FeaturesSection = { eyebrow: '', title: '', highlight: '', desc: '', items: [] }
  const [form, setForm] = useState<FeaturesSection>({ ...featureDefaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const setMeta = (k: keyof Omit<FeaturesSection, 'items'>, v: string) => setForm(f => ({ ...f, [k]: v }))
  const updateItem = (i: number, k: keyof FeatureItem, v: string) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [k]: v } : item) }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { icon: '✦', title: '', desc: '', accent: '#a855f7' }] }))
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
        <Field label="Eyebrow">
          <input className="admin-input" value={form.eyebrow} onChange={e => setMeta('eyebrow', e.target.value)} />
        </Field>
        <Field label="Title">
          <input className="admin-input" value={form.title} onChange={e => setMeta('title', e.target.value)} />
        </Field>
        <Field label="Highlight">
          <input className="admin-input" value={form.highlight} onChange={e => setMeta('highlight', e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className="admin-input" rows={2} value={form.desc} onChange={e => setMeta('desc', e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      <div style={{ marginTop: 20, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--nt-text)' }}>
        Feature Cards
      </div>
      {form.items.map((item, i) => (
        <div key={i} className="cms-list-item" style={{ flexWrap: 'wrap', padding: '16px', background: 'var(--nt-bg-raised)', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: '0 12px', width: '100%', alignItems: 'start' }}>
            <Field label="Icon">
              <input className="admin-input" value={item.icon} onChange={e => updateItem(i, 'icon', e.target.value)} style={{ textAlign: 'center' }} />
            </Field>
            <Field label="Title">
              <input className="admin-input" value={item.title} onChange={e => updateItem(i, 'title', e.target.value)} />
            </Field>
            <div className="cms-color-row" style={{ marginTop: 22 }}>
              <Field label="Accent">
                <input type="color" className="cms-color-swatch" value={item.accent} onChange={e => updateItem(i, 'accent', e.target.value)} />
              </Field>
              <button className="admin-btn" style={{ marginTop: 22 }} onClick={() => removeItem(i)}>✕</button>
            </div>
          </div>
          <div style={{ width: '100%' }}>
            <Field label="Description">
              <textarea className="admin-input" rows={2} value={item.desc} onChange={e => updateItem(i, 'desc', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>
          </div>
        </div>
      ))}
      <button className="cms-add-btn" onClick={addItem}>+ Add feature card</button>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

// How It Works
function HowEditor({ data, saving, saveMsg, onSave }: {
  data: HowSection
  saving: boolean
  saveMsg: string
  onSave: (d: HowSection) => void
}) {
  const howDefaults: HowSection = { eyebrow: '', title: '', highlight: '', items: [] }
  const [form, setForm] = useState<HowSection>({ ...howDefaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const setMeta = (k: keyof Omit<HowSection, 'items'>, v: string) => setForm(f => ({ ...f, [k]: v }))
  const updateItem = (i: number, k: keyof StepItem, v: string) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [k]: v } : item) }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { num: String(f.items.length + 1).padStart(2, '0'), title: '', desc: '' }] }))
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
        <Field label="Eyebrow">
          <input className="admin-input" value={form.eyebrow} onChange={e => setMeta('eyebrow', e.target.value)} />
        </Field>
        <Field label="Title">
          <input className="admin-input" value={form.title} onChange={e => setMeta('title', e.target.value)} />
        </Field>
        <Field label="Highlight">
          <input className="admin-input" value={form.highlight} onChange={e => setMeta('highlight', e.target.value)} />
        </Field>
      </div>
      <div style={{ marginTop: 20, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--nt-text)' }}>Steps</div>
      {form.items.map((item, i) => (
        <div key={i} className="cms-list-item">
          <div style={{ flex: '0 0 80px' }}>
            <Field label="Number">
              <input className="admin-input" value={item.num} onChange={e => updateItem(i, 'num', e.target.value)} style={{ textAlign: 'center' }} />
            </Field>
          </div>
          <div style={{ flex: '0 0 200px' }}>
            <Field label="Title">
              <input className="admin-input" value={item.title} onChange={e => updateItem(i, 'title', e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Description">
              <textarea className="admin-input" rows={2} value={item.desc} onChange={e => updateItem(i, 'desc', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>
          </div>
          <button className="admin-btn" style={{ marginTop: 22 }} onClick={() => removeItem(i)}>✕</button>
        </div>
      ))}
      <button className="cms-add-btn" onClick={addItem}>+ Add step</button>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

// Compare
function CompareEditor({ data, saving, saveMsg, onSave }: {
  data: CompareSection
  saving: boolean
  saveMsg: string
  onSave: (d: CompareSection) => void
}) {
  const compareDefaults: CompareSection = { eyebrow: '', title: '', highlight: '', rows: [] }
  const [form, setForm] = useState<CompareSection>({ ...compareDefaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const setMeta = (k: keyof Omit<CompareSection, 'rows'>, v: string) => setForm(f => ({ ...f, [k]: v }))
  const updateRow = (i: number, k: keyof CompareRow, v: string) =>
    setForm(f => ({ ...f, rows: f.rows.map((row, idx) => idx === i ? { ...row, [k]: v } : row) }))
  const addRow = () => setForm(f => ({ ...f, rows: [...f.rows, { feature: '', nt: '✓ ', trad: '✗ ' }] }))
  const removeRow = (i: number) => setForm(f => ({ ...f, rows: f.rows.filter((_, idx) => idx !== i) }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
        <Field label="Eyebrow">
          <input className="admin-input" value={form.eyebrow} onChange={e => setMeta('eyebrow', e.target.value)} />
        </Field>
        <Field label="Title">
          <input className="admin-input" value={form.title} onChange={e => setMeta('title', e.target.value)} />
        </Field>
        <Field label="Highlight">
          <input className="admin-input" value={form.highlight} onChange={e => setMeta('highlight', e.target.value)} />
        </Field>
      </div>
      <div style={{ marginTop: 20, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--nt-text)' }}>Comparison Rows</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0 8px', marginBottom: 8 }}>
        {['Feature', 'NeuroTek AI', 'Traditional DAW', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--nt-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
        ))}
      </div>
      {form.rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0 8px', marginBottom: 8, alignItems: 'center' }}>
          <input className="admin-input" value={row.feature} onChange={e => updateRow(i, 'feature', e.target.value)} placeholder="Feature name" />
          <input className="admin-input" value={row.nt} onChange={e => updateRow(i, 'nt', e.target.value)} placeholder="✓ Built-in" />
          <input className="admin-input" value={row.trad} onChange={e => updateRow(i, 'trad', e.target.value)} placeholder="✗ No" />
          <button className="admin-btn" onClick={() => removeRow(i)}>✕</button>
        </div>
      ))}
      <button className="cms-add-btn" onClick={addRow}>+ Add row</button>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

// Pricing
function PricingEditor({ data, saving, saveMsg, onSave }: {
  data: PricingSection
  saving: boolean
  saveMsg: string
  onSave: (d: PricingSection) => void
}) {
  const pricingDefaults: PricingSection = { eyebrow: '', title: '', highlight: '', desc: '' }
  const [form, setForm] = useState<PricingSection>({ ...pricingDefaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const set = (k: keyof PricingSection, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div className="cms-section-note" style={{ marginBottom: 20 }}>
        Plan cards (price, features, tiers) are managed in <strong>Subscriptions → Plans</strong>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px' }}>
        <Field label="Eyebrow">
          <input className="admin-input" value={form.eyebrow} onChange={e => set('eyebrow', e.target.value)} />
        </Field>
        <Field label="Title">
          <input className="admin-input" value={form.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <Field label="Highlight word">
          <input className="admin-input" value={form.highlight} onChange={e => set('highlight', e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className="admin-input" rows={3} value={form.desc} onChange={e => set('desc', e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

// CTA
function CtaEditor({ data, saving, saveMsg, onSave }: {
  data: CtaSection
  saving: boolean
  saveMsg: string
  onSave: (d: CtaSection) => void
}) {
  const ctaDefaults: CtaSection = { title: '', highlight: '', subtitle: '', cta1Text: '', cta1Url: '', cta2Text: '', cta2Url: '' }
  const [form, setForm] = useState<CtaSection>({ ...ctaDefaults, ...data })
  useEffect(() => { setForm(f => ({ ...f, ...data })) }, [data])
  const set = (k: keyof CtaSection, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="admin-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Field label="Title">
          <input className="admin-input" value={form.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <Field label="Highlight word">
          <input className="admin-input" value={form.highlight} onChange={e => set('highlight', e.target.value)} />
        </Field>
        <Field label="CTA 1 text">
          <input className="admin-input" value={form.cta1Text} onChange={e => set('cta1Text', e.target.value)} />
        </Field>
        <Field label="CTA 1 URL">
          <input className="admin-input" value={form.cta1Url} onChange={e => set('cta1Url', e.target.value)} />
        </Field>
        <Field label="CTA 2 text">
          <input className="admin-input" value={form.cta2Text} onChange={e => set('cta2Text', e.target.value)} />
        </Field>
        <Field label="CTA 2 URL">
          <input className="admin-input" value={form.cta2Url} onChange={e => set('cta2Url', e.target.value)} />
        </Field>
      </div>
      <Field label="Subtitle">
        <textarea className="admin-input" rows={3} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      <SaveBar saving={saving} saveMsg={saveMsg} onSave={() => onSave(form)} />
    </div>
  )
}

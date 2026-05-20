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

interface NavLinkItem { label: string; to: string; visible: boolean }
interface FooterLinkItem { label: string; href: string; external: boolean }
interface FooterColumnItem { title: string; links: FooterLinkItem[] }
interface NavbarCms {
  logoText: string; logoHighlight: string
  announcementBar: { show: boolean; text: string; url: string; type: string }
  links: NavLinkItem[]
  primaryCta: { text: string; to: string }
  secondaryCta: { text: string; to: string }
}
interface FooterCms {
  tagline: string; copyright: string
  social: { github: string; twitter: string; discord: string }
  columns: FooterColumnItem[]
}
interface BrandingCms {
  appName: string; logoText: string; logoHighlight: string; tagline: string
  logoGradientStart: string; logoGradientEnd: string
}
interface ColorsCms {
  accentPrimary: string; accentSecondary: string
  gradientStart: string; gradientMid: string; gradientEnd: string
}
interface MarketingCms {
  promotionalBanner: { show: boolean; text: string; url: string; type: string }
  socialProof: { rating: string; count: string; label: string }
  featuredSection: { show: boolean; title: string; subtitle: string }
}

type CmsTab = 'hero' | 'logos' | 'stats' | 'features' | 'how' | 'compare' | 'pricing' | 'cta' | 'navbar' | 'footer' | 'branding' | 'colors' | 'marketing'

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
  const [navbarDraft, setNavbarDraft] = useState<NavbarCms | null>(null)
  const [footerDraft, setFooterDraft] = useState<FooterCms | null>(null)
  const [brandingDraft, setBrandingDraft] = useState<BrandingCms | null>(null)
  const [colorsDraft, setColorsDraft] = useState<ColorsCms | null>(null)
  const [marketingDraft, setMarketingDraft] = useState<MarketingCms | null>(null)

  useEffect(() => {
    apiGet<{ success: boolean; data: Record<string, unknown> }>('/api/admin/cms')
      .then(res => {
        if (res.data) {
          setContent(res.data)
          if (res.data['navbar'])    setNavbarDraft(res.data['navbar'] as NavbarCms)
          if (res.data['footer'])    setFooterDraft(res.data['footer'] as FooterCms)
          if (res.data['branding'])  setBrandingDraft(res.data['branding'] as BrandingCms)
          if (res.data['colors'])    setColorsDraft(res.data['colors'] as ColorsCms)
          if (res.data['marketing']) setMarketingDraft(res.data['marketing'] as MarketingCms)
        }
      })
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
        <button className={`admin-tab-btn${activeTab === 'navbar' ? ' active' : ''}`} onClick={() => setActiveTab('navbar')}>Navbar</button>
        <button className={`admin-tab-btn${activeTab === 'footer' ? ' active' : ''}`} onClick={() => setActiveTab('footer')}>Footer</button>
        <button className={`admin-tab-btn${activeTab === 'branding' ? ' active' : ''}`} onClick={() => setActiveTab('branding')}>Branding</button>
        <button className={`admin-tab-btn${activeTab === 'colors' ? ' active' : ''}`} onClick={() => setActiveTab('colors')}>Colors</button>
        <button className={`admin-tab-btn${activeTab === 'marketing' ? ' active' : ''}`} onClick={() => setActiveTab('marketing')}>Marketing</button>
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

      {/* ── Navbar ── */}
      {activeTab === 'navbar' && navbarDraft && (
        <div>
          <p className="cms-section-note">Controls the top navigation bar on all pages.</p>
          <div className="admin-plan-editor-grid">
            <label>Logo Text<input className="admin-input" value={navbarDraft.logoText} onChange={e => setNavbarDraft({...navbarDraft, logoText: e.target.value})} /></label>
            <label>Logo Highlight<input className="admin-input" value={navbarDraft.logoHighlight} onChange={e => setNavbarDraft({...navbarDraft, logoHighlight: e.target.value})} /></label>
            <label>Primary CTA Text<input className="admin-input" value={navbarDraft.primaryCta.text} onChange={e => setNavbarDraft({...navbarDraft, primaryCta: {...navbarDraft.primaryCta, text: e.target.value}})} /></label>
            <label>Primary CTA URL<input className="admin-input" value={navbarDraft.primaryCta.to} onChange={e => setNavbarDraft({...navbarDraft, primaryCta: {...navbarDraft.primaryCta, to: e.target.value}})} /></label>
            <label>Secondary CTA Text<input className="admin-input" value={navbarDraft.secondaryCta.text} onChange={e => setNavbarDraft({...navbarDraft, secondaryCta: {...navbarDraft.secondaryCta, text: e.target.value}})} /></label>
            <label>Secondary CTA URL<input className="admin-input" value={navbarDraft.secondaryCta.to} onChange={e => setNavbarDraft({...navbarDraft, secondaryCta: {...navbarDraft.secondaryCta, to: e.target.value}})} /></label>
          </div>
          <h4 style={{margin:'16px 0 10px',fontSize:14}}>Announcement Bar</h4>
          <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <input type="checkbox" checked={navbarDraft.announcementBar.show} onChange={e => setNavbarDraft({...navbarDraft, announcementBar:{...navbarDraft.announcementBar, show: e.target.checked}})} />
            Show announcement bar
          </label>
          <div className="admin-plan-editor-grid">
            <label style={{gridColumn:'span 2'}}>Text<input className="admin-input" value={navbarDraft.announcementBar.text} onChange={e => setNavbarDraft({...navbarDraft, announcementBar:{...navbarDraft.announcementBar, text: e.target.value}})} /></label>
            <label>URL<input className="admin-input" value={navbarDraft.announcementBar.url} onChange={e => setNavbarDraft({...navbarDraft, announcementBar:{...navbarDraft.announcementBar, url: e.target.value}})} /></label>
            <label>Type<select className="admin-input" value={navbarDraft.announcementBar.type} onChange={e => setNavbarDraft({...navbarDraft, announcementBar:{...navbarDraft.announcementBar, type: e.target.value}})}>
              <option value="info">Info (blue)</option>
              <option value="promo">Promo (purple)</option>
              <option value="warning">Warning (yellow)</option>
            </select></label>
          </div>
          <h4 style={{margin:'16px 0 10px',fontSize:14}}>Navigation Links</h4>
          {navbarDraft.links.map((link, i) => (
            <div key={i} className="cms-list-item">
              <input className="admin-input" style={{flex:'0 0 120px'}} placeholder="Label" value={link.label} onChange={e => { const l=[...navbarDraft.links]; l[i]={...l[i],label:e.target.value}; setNavbarDraft({...navbarDraft,links:l}) }} />
              <input className="admin-input" style={{flex:1}} placeholder="URL" value={link.to} onChange={e => { const l=[...navbarDraft.links]; l[i]={...l[i],to:e.target.value}; setNavbarDraft({...navbarDraft,links:l}) }} />
              <label style={{display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',fontSize:13}}>
                <input type="checkbox" checked={link.visible} onChange={e => { const l=[...navbarDraft.links]; l[i]={...l[i],visible:e.target.checked}; setNavbarDraft({...navbarDraft,links:l}) }} />Visible
              </label>
              <button className="admin-btn" onClick={() => setNavbarDraft({...navbarDraft, links: navbarDraft.links.filter((_,j)=>j!==i)})}>✕</button>
            </div>
          ))}
          <button className="cms-add-btn" onClick={() => setNavbarDraft({...navbarDraft, links:[...navbarDraft.links,{label:'New',to:'/',visible:true}]})}>+ Add Link</button>
          <div className="cms-save-bar">
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => save('navbar', navbarDraft)}>{saving?'Saving…':'Save Navbar'}</button>
            {saveMsg && <span className="cms-save-msg">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {activeTab === 'footer' && footerDraft && (
        <div>
          <p className="cms-section-note">Controls the footer on all pages.</p>
          <div className="admin-plan-editor-grid">
            <label style={{gridColumn:'span 2'}}>Tagline<textarea className="admin-input" rows={2} value={footerDraft.tagline} onChange={e => setFooterDraft({...footerDraft,tagline:e.target.value})} /></label>
            <label style={{gridColumn:'span 2'}}>Copyright<input className="admin-input" value={footerDraft.copyright} onChange={e => setFooterDraft({...footerDraft,copyright:e.target.value})} /></label>
          </div>
          <h4 style={{margin:'16px 0 10px',fontSize:14}}>Social Links</h4>
          <div className="admin-plan-editor-grid">
            <label>GitHub<input className="admin-input" value={footerDraft.social.github} onChange={e => setFooterDraft({...footerDraft,social:{...footerDraft.social,github:e.target.value}})} /></label>
            <label>Twitter/X<input className="admin-input" value={footerDraft.social.twitter} onChange={e => setFooterDraft({...footerDraft,social:{...footerDraft.social,twitter:e.target.value}})} /></label>
            <label>Discord<input className="admin-input" value={footerDraft.social.discord} onChange={e => setFooterDraft({...footerDraft,social:{...footerDraft.social,discord:e.target.value}})} /></label>
          </div>
          <h4 style={{margin:'16px 0 10px',fontSize:14}}>Footer Columns</h4>
          {footerDraft.columns.map((col, ci) => (
            <div key={ci} style={{marginBottom:16,padding:12,background:'var(--admin-bg)',borderRadius:8,border:'1px solid var(--admin-border)'}}>
              <input className="admin-input" style={{marginBottom:8,fontWeight:600}} value={col.title} onChange={e => { const c=footerDraft.columns.map((x,j)=>j===ci?{...x,title:e.target.value}:x); setFooterDraft({...footerDraft,columns:c}) }} />
              {col.links.map((link, li) => (
                <div key={li} className="cms-list-item">
                  <input className="admin-input" style={{flex:'0 0 130px'}} placeholder="Label" value={link.label} onChange={e => { const c=footerDraft.columns.map((x,j)=>j!==ci?x:{...x,links:x.links.map((l,k)=>k===li?{...l,label:e.target.value}:l)}); setFooterDraft({...footerDraft,columns:c}) }} />
                  <input className="admin-input" style={{flex:1}} placeholder="URL" value={link.href} onChange={e => { const c=footerDraft.columns.map((x,j)=>j!==ci?x:{...x,links:x.links.map((l,k)=>k===li?{...l,href:e.target.value}:l)}); setFooterDraft({...footerDraft,columns:c}) }} />
                  <label style={{display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',fontSize:13}}><input type="checkbox" checked={link.external} onChange={e => { const c=footerDraft.columns.map((x,j)=>j!==ci?x:{...x,links:x.links.map((l,k)=>k===li?{...l,external:e.target.checked}:l)}); setFooterDraft({...footerDraft,columns:c}) }} />External</label>
                  <button className="admin-btn" onClick={() => { const c=footerDraft.columns.map((x,j)=>j!==ci?x:{...x,links:x.links.filter((_,k)=>k!==li)}); setFooterDraft({...footerDraft,columns:c}) }}>✕</button>
                </div>
              ))}
              <button className="cms-add-btn" onClick={() => { const c=footerDraft.columns.map((x,j)=>j!==ci?x:{...x,links:[...x.links,{label:'New',href:'/',external:false}]}); setFooterDraft({...footerDraft,columns:c}) }}>+ Add Link</button>
            </div>
          ))}
          <div className="cms-save-bar">
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => save('footer', footerDraft)}>{saving?'Saving…':'Save Footer'}</button>
            {saveMsg && <span className="cms-save-msg">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Branding ── */}
      {activeTab === 'branding' && brandingDraft && (
        <div>
          <p className="cms-section-note">Controls the app name, logo text and gradient colors across the entire site.</p>
          <div className="admin-plan-editor-grid">
            <label>App Name<input className="admin-input" value={brandingDraft.appName} onChange={e => setBrandingDraft({...brandingDraft,appName:e.target.value})} /></label>
            <label>Logo Text<input className="admin-input" value={brandingDraft.logoText} onChange={e => setBrandingDraft({...brandingDraft,logoText:e.target.value})} /></label>
            <label>Logo Highlight<input className="admin-input" value={brandingDraft.logoHighlight} onChange={e => setBrandingDraft({...brandingDraft,logoHighlight:e.target.value})} /></label>
            <label style={{gridColumn:'span 2'}}>Tagline<input className="admin-input" value={brandingDraft.tagline} onChange={e => setBrandingDraft({...brandingDraft,tagline:e.target.value})} /></label>
          </div>
          <h4 style={{margin:'16px 0 10px',fontSize:14}}>Logo Gradient</h4>
          <div className="admin-plan-editor-grid">
            <label>Start Color<div className="cms-color-row"><input type="color" className="cms-color-swatch" value={brandingDraft.logoGradientStart} onChange={e => setBrandingDraft({...brandingDraft,logoGradientStart:e.target.value})} /><input className="admin-input" value={brandingDraft.logoGradientStart} onChange={e => setBrandingDraft({...brandingDraft,logoGradientStart:e.target.value})} /></div></label>
            <label>End Color<div className="cms-color-row"><input type="color" className="cms-color-swatch" value={brandingDraft.logoGradientEnd} onChange={e => setBrandingDraft({...brandingDraft,logoGradientEnd:e.target.value})} /><input className="admin-input" value={brandingDraft.logoGradientEnd} onChange={e => setBrandingDraft({...brandingDraft,logoGradientEnd:e.target.value})} /></div></label>
          </div>
          <div className="cms-save-bar">
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => save('branding', brandingDraft)}>{saving?'Saving…':'Save Branding'}</button>
            {saveMsg && <span className="cms-save-msg">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Colors ── */}
      {activeTab === 'colors' && colorsDraft && (
        <div>
          <p className="cms-section-note">Changes site-wide accent colors (applied as CSS custom properties). Visitors see the new colors on next page load.</p>
          {([
            {key:'accentPrimary' as keyof ColorsCms,  label:'Primary Accent'},
            {key:'accentSecondary' as keyof ColorsCms,label:'Secondary Accent'},
            {key:'gradientStart' as keyof ColorsCms,  label:'Gradient Start'},
            {key:'gradientMid' as keyof ColorsCms,    label:'Gradient Mid'},
            {key:'gradientEnd' as keyof ColorsCms,    label:'Gradient End'},
          ]).map(({key,label}) => (
            <div key={key} style={{marginBottom:14}}>
              <div style={{fontSize:13,color:'var(--admin-text-muted)',marginBottom:6}}>{label}</div>
              <div className="cms-color-row">
                <input type="color" className="cms-color-swatch" value={colorsDraft[key]} onChange={e => setColorsDraft({...colorsDraft,[key]:e.target.value})} />
                <input className="admin-input" value={colorsDraft[key]} onChange={e => setColorsDraft({...colorsDraft,[key]:e.target.value})} />
                <div style={{width:36,height:36,borderRadius:6,background:colorsDraft[key],border:'1px solid var(--admin-border)',flexShrink:0}} />
              </div>
            </div>
          ))}
          <div className="cms-save-bar">
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => save('colors', colorsDraft)}>{saving?'Saving…':'Save Colors'}</button>
            {saveMsg && <span className="cms-save-msg">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Marketing ── */}
      {activeTab === 'marketing' && marketingDraft && (
        <div>
          <p className="cms-section-note">Controls promotional banners, social proof stats, and featured content visibility.</p>
          <h4 style={{margin:'0 0 10px',fontSize:14}}>Promotional Banner</h4>
          <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <input type="checkbox" checked={marketingDraft.promotionalBanner.show} onChange={e => setMarketingDraft({...marketingDraft,promotionalBanner:{...marketingDraft.promotionalBanner,show:e.target.checked}})} />
            Show announcement bar sitewide
          </label>
          <div className="admin-plan-editor-grid">
            <label style={{gridColumn:'span 2'}}>Banner Text<input className="admin-input" value={marketingDraft.promotionalBanner.text} onChange={e => setMarketingDraft({...marketingDraft,promotionalBanner:{...marketingDraft.promotionalBanner,text:e.target.value}})} /></label>
            <label>URL<input className="admin-input" value={marketingDraft.promotionalBanner.url} onChange={e => setMarketingDraft({...marketingDraft,promotionalBanner:{...marketingDraft.promotionalBanner,url:e.target.value}})} /></label>
            <label>Type<select className="admin-input" value={marketingDraft.promotionalBanner.type} onChange={e => setMarketingDraft({...marketingDraft,promotionalBanner:{...marketingDraft.promotionalBanner,type:e.target.value}})}>
              <option value="info">Info</option><option value="promo">Promo</option><option value="warning">Warning</option>
            </select></label>
          </div>
          <h4 style={{margin:'20px 0 10px',fontSize:14}}>Social Proof (displayed in hero)</h4>
          <div className="admin-plan-editor-grid">
            <label>Rating<input className="admin-input" value={marketingDraft.socialProof.rating} onChange={e => setMarketingDraft({...marketingDraft,socialProof:{...marketingDraft.socialProof,rating:e.target.value}})} /></label>
            <label>Count<input className="admin-input" value={marketingDraft.socialProof.count} onChange={e => setMarketingDraft({...marketingDraft,socialProof:{...marketingDraft.socialProof,count:e.target.value}})} /></label>
            <label>Label<input className="admin-input" value={marketingDraft.socialProof.label} onChange={e => setMarketingDraft({...marketingDraft,socialProof:{...marketingDraft.socialProof,label:e.target.value}})} /></label>
          </div>
          <h4 style={{margin:'20px 0 10px',fontSize:14}}>Featured Section</h4>
          <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <input type="checkbox" checked={marketingDraft.featuredSection.show} onChange={e => setMarketingDraft({...marketingDraft,featuredSection:{...marketingDraft.featuredSection,show:e.target.checked}})} />
            Show featured section on homepage
          </label>
          <div className="admin-plan-editor-grid">
            <label>Title<input className="admin-input" value={marketingDraft.featuredSection.title} onChange={e => setMarketingDraft({...marketingDraft,featuredSection:{...marketingDraft.featuredSection,title:e.target.value}})} /></label>
            <label>Subtitle<input className="admin-input" value={marketingDraft.featuredSection.subtitle} onChange={e => setMarketingDraft({...marketingDraft,featuredSection:{...marketingDraft.featuredSection,subtitle:e.target.value}})} /></label>
          </div>
          <div className="cms-save-bar">
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => save('marketing', marketingDraft)}>{saving?'Saving…':'Save Marketing'}</button>
            {saveMsg && <span className="cms-save-msg">{saveMsg}</span>}
          </div>
        </div>
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

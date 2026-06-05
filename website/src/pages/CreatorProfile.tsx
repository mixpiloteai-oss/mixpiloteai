import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import './CreatorProfile.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionTier {
  name: string
  price: number
  perks: string[]
  highlight?: boolean
}

interface CreatorData {
  id: string
  slug: string
  name: string
  bio: string
  verified: boolean
  genre: string[]
  followers: number
  products: number
  totalDownloads: number
  avatarColor: string
  bannerGradient: string
  social: {
    twitter?: string
    instagram?: string
    soundcloud?: string
  }
  tiers: SubscriptionTier[]
}

interface ProductItem {
  id: string
  name: string
  category: string
  price: number
  downloads: number
  likes: number
  rating: number
  tags: string[]
  cover: string
  description: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CREATOR_DATA: Record<string, CreatorData> = {
  'irn-factory': {
    id: 'c1',
    slug: 'irn-factory',
    name: 'IRN Factory',
    bio: 'Industrial techno and EBM producer from Berlin. Over a decade of crafting machine-made sounds for the underground dancefloor. Resident at Tresor and Berghain, my kits are engineered to cut through any system.',
    verified: true,
    genre: ['Techno', 'Industrial', 'EBM'],
    followers: 12400,
    products: 18,
    totalDownloads: 84200,
    avatarColor: '#7c3aed',
    bannerGradient: 'linear-gradient(135deg, #1a0a2e 0%, #0a0a1a 50%, #2e0a1a 100%)',
    social: { twitter: 'irn_factory', instagram: 'irn.factory', soundcloud: 'irn-factory' },
    tiers: [
      { name: 'Basic', price: 4.99, perks: ['Access to free releases', 'Early download notifications', 'Discord community access'] },
      { name: 'Pro', price: 9.99, perks: ['Everything in Basic', '10% discount on all products', 'Exclusive monthly kick pack', 'Direct feedback on your mixes'], highlight: true },
      { name: 'Studio', price: 24.99, perks: ['Everything in Pro', 'Unlimited downloads of full catalogue', 'Monthly 1:1 feedback session', 'Source files for selected packs', 'Name in release credits'] },
    ],
  },
  'dark-collective': {
    id: 'c2',
    slug: 'dark-collective',
    name: 'Dark Collective',
    bio: 'A collective of underground producers specialising in hard trap, drill, and experimental club music. Based in London, we release exclusively through NeuroTek AI Marketplace. Free packs every month.',
    verified: true,
    genre: ['Trap', 'Drill', 'Phonk'],
    followers: 28900,
    products: 31,
    totalDownloads: 219400,
    avatarColor: '#0891b2',
    bannerGradient: 'linear-gradient(135deg, #0a1a2e 0%, #0a0a1a 50%, #0a2e1a 100%)',
    social: { twitter: 'darkcollectivebeats', instagram: 'darkcollective', soundcloud: 'dark-collective' },
    tiers: [
      { name: 'Follower', price: 0, perks: ['Free monthly sample pack', 'Newsletter updates', 'Community access'] },
      { name: 'Member', price: 7.99, perks: ['Everything in Follower', 'Full back-catalogue access', '20% off all paid products', 'Exclusive WIP previews'], highlight: true },
      { name: 'Inner Circle', price: 19.99, perks: ['Everything in Member', 'Unreleased demos each month', 'Co-production opportunity (quarterly draw)', 'Producer credit on select releases'] },
    ],
  },
  'synthmaster': {
    id: 'c3',
    slug: 'synthmaster',
    name: 'SynthMaster',
    bio: 'Preset designer and sound architect obsessed with synthesis. I build production-ready presets for Serum, Massive X, and Vital. Every preset is tweaked by hand — no auto-generated fluff.',
    verified: true,
    genre: ['Future Bass', 'Dubstep', 'Synth'],
    followers: 9800,
    products: 22,
    totalDownloads: 61300,
    avatarColor: '#059669',
    bannerGradient: 'linear-gradient(135deg, #0a2e0a 0%, #0a0a1a 50%, #1a2e0a 100%)',
    social: { instagram: 'synthmaster_official', soundcloud: 'synthmaster-audio' },
    tiers: [
      { name: 'Starter', price: 5.99, perks: ['1 preset pack per month', 'Video tutorials access', 'Email support'] },
      { name: 'Advanced', price: 14.99, perks: ['Everything in Starter', '3 preset packs per month', 'Patch request submissions', 'One-on-one synth coaching (monthly)'], highlight: true },
    ],
  },
  'c1': {
    id: 'c1',
    slug: 'irn-factory',
    name: 'IRN Factory',
    bio: 'Industrial techno and EBM producer from Berlin.',
    verified: true,
    genre: ['Techno', 'Industrial'],
    followers: 12400,
    products: 18,
    totalDownloads: 84200,
    avatarColor: '#7c3aed',
    bannerGradient: 'linear-gradient(135deg, #1a0a2e 0%, #0a0a1a 100%)',
    social: { twitter: 'irn_factory' },
    tiers: [
      { name: 'Pro', price: 9.99, perks: ['Monthly kick pack', '10% discount', 'Discord access'], highlight: true },
    ],
  },
}

const CREATOR_PRODUCTS: Record<string, ProductItem[]> = {
  'irn-factory': [
    { id: 'p1', name: 'Dark Techno Kicks Vol.1', category: 'kick',  price: 9.99,  downloads: 2847, likes: 234, rating: 4.8, tags: ['Techno', 'Industrial'], cover: '#1a0a2e', description: 'Hard-hitting industrial techno kicks.' },
    { id: 'p8', name: '808 Sound Bank Pro',      category: 'sound-bank', price: 24.99, downloads: 5671, likes: 734, rating: 4.7, tags: ['808', 'Trap'],    cover: '#1a1a2e', description: '200+ tuned 808s for maximum sub.' },
    { id: 'p16',name: 'Snare Clap Collection',   category: 'snare', price: 6.99,  downloads: 3445, likes: 423, rating: 4.7, tags: ['Boom Bap', 'Clap'],   cover: '#0e1a2e', description: 'Classic boom bap snares from vintage hardware.' },
  ],
  'dark-collective': [
    { id: 'p2', name: 'Wannamaker Snares',      category: 'snare',  price: 0,     downloads: 8421, likes: 891, rating: 4.9, tags: ['Free', 'Trap'],       cover: '#0a1a2e', description: 'The iconic Wannamaker snare collection.' },
    { id: 'p6', name: 'UK Drill Strings Vol.2', category: 'sample', price: 11.99, downloads: 4509, likes: 567, rating: 4.8, tags: ['Drill', 'UK'],        cover: '#2e0a0a', description: 'Cinematic strings for UK drill.' },
    { id: 'p10',name: 'Trap Hi-Hat Toolkit',    category: 'hat',    price: 5.99,  downloads: 3891, likes: 489, rating: 4.6, tags: ['Trap', 'Hi-Hat'],     cover: '#1e0a2e', description: '500+ trap hi-hat samples.' },
    { id: 'p18',name: 'Trap Kick One-Shots',    category: 'kick',   price: 0,     downloads: 9087, likes: 1123,rating: 4.8, tags: ['Free', 'Trap'],       cover: '#2e0e0a', description: '200+ trap kicks, free.' },
  ],
  'synthmaster': [
    { id: 'p3', name: 'Serum Acid Bass Presets', category: 'preset', price: 14.99, downloads: 1203, likes: 156, rating: 4.7, tags: ['Serum', 'Acid'],    cover: '#1a2e0a', description: '60 acid bass presets for Serum.' },
    { id: 'p7', name: 'Future Bass Chords Pack', category: 'sample', price: 0,     downloads: 11203,likes: 1456,rating: 4.9, tags: ['Free', 'Future Bass'],cover: '#0a2e2e', description: 'Lush future bass chord stabs, free.' },
    { id: 'p11',name: 'Massive X Bass Presets',  category: 'preset', price: 12.99, downloads: 987, likes: 134, rating: 4.5, tags: ['Massive X', 'Bass'],  cover: '#0a0a2e', description: '80 bass presets for Massive X.' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Component ────────────────────────────────────────────────────────────────

function CreatorProfile() {
  const { slug } = useParams<{ slug: string }>()
  const creator = slug ? (CREATOR_DATA[slug] ?? null) : null
  const products = slug ? (CREATOR_PRODUCTS[slug] ?? []) : []

  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(creator?.followers ?? 0)
  const [subscribedTier, setSubscribedTier] = useState<string | null>(null)

  if (!creator) {
    return (
      <div className="creator-profile-page">
        <div className="container" style={{ paddingTop: 120, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>404</div>
          <p>Creator not found.</p>
          <Link to="/marketplace" className="btn-secondary" style={{ marginTop: 24, display: 'inline-flex' }}>
            Back to Marketplace
          </Link>
        </div>
      </div>
    )
  }

  function handleFollow() {
    setFollowing(prev => {
      const next = !prev
      setFollowerCount(c => next ? c + 1 : c - 1)
      return next
    })
  }

  return (
    <div className="creator-profile-page">

      {/* ── Banner ── */}
      <div className="creator-banner" style={{ background: creator.bannerGradient }}>
        <div className="creator-banner-overlay" />
      </div>

      {/* ── Profile Header ── */}
      <div className="creator-profile-header">
        <div className="container">
          <div className="creator-profile-row">
            <div className="creator-profile-avatar-wrap">
              <div className="creator-profile-avatar" style={{ background: creator.avatarColor }}>
                {creator.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              {creator.verified && (
                <span className="creator-verified-badge" title="Verified Creator">✓</span>
              )}
            </div>
            <div className="creator-profile-meta">
              <h1 className="creator-profile-name">{creator.name}</h1>
              <div className="creator-profile-genres">
                {creator.genre.map(g => <span key={g} className="pack-tag">{g}</span>)}
              </div>
              <div className="creator-profile-social">
                {creator.social.twitter && (
                  <a href={`https://twitter.com/${creator.social.twitter}`} className="social-link" target="_blank" rel="noreferrer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.262 5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    @{creator.social.twitter}
                  </a>
                )}
                {creator.social.instagram && (
                  <a href={`https://instagram.com/${creator.social.instagram}`} className="social-link" target="_blank" rel="noreferrer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" /></svg>
                    @{creator.social.instagram}
                  </a>
                )}
                {creator.social.soundcloud && (
                  <a href={`https://soundcloud.com/${creator.social.soundcloud}`} className="social-link" target="_blank" rel="noreferrer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.43-.03 2.52-1.18 2.52-2.61 0-1.41-1.07-2.55-2.48-2.6-.22 0-.44.03-.65.08-.29-3.01-2.76-5.37-5.84-5.37-1.12 0-2.16.31-3.04.85l.73 1.52zM0 15c0 1.1.9 2 2 2s2-.9 2-2V11c0-1.1-.9-2-2-2S0 9.9 0 11v4zm4.5 0c0 1.1.9 2 2 2s2-.9 2-2V9.5c0-1.1-.9-2-2-2s-2 .9-2 2V15zm4.5.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5S9 7.67 9 8.5v7z" /></svg>
                    {creator.social.soundcloud}
                  </a>
                )}
              </div>
            </div>
            <div className="creator-profile-actions">
              <button
                className={following ? 'btn-secondary follow-btn following' : 'btn-primary follow-btn'}
                onClick={handleFollow}
              >
                {following ? 'Following ✓' : '+ Follow'}
              </button>
              <Link to="/creator-dashboard" className="btn-secondary" style={{ padding: '10px 18px', fontSize: '13px' }}>
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="creator-stats-bar">
        <div className="container">
          <div className="creator-stats-row">
            <div className="creator-stat">
              <div className="creator-stat-value">{fmtNum(creator.totalDownloads)}</div>
              <div className="creator-stat-label">Downloads</div>
            </div>
            <div className="creator-stat">
              <div className="creator-stat-value">{creator.products}</div>
              <div className="creator-stat-label">Products</div>
            </div>
            <div className="creator-stat">
              <div className="creator-stat-value">{fmtNum(followerCount)}</div>
              <div className="creator-stat-label">Followers</div>
            </div>
            <div className="creator-stat creator-stat-locked">
              <div className="creator-stat-value creator-stat-masked">Join to see</div>
              <div className="creator-stat-label">Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bio ── */}
      <section className="section-sm creator-bio-section">
        <div className="container">
          <div className="creator-bio-layout">
            <div className="creator-bio-main">
              <div className="section-label">About</div>
              <p className="creator-bio-text">{creator.bio}</p>

              {/* Products */}
              {products.length > 0 && (
                <div className="creator-products-section">
                  <div className="section-label" style={{ marginTop: 40 }}>Products</div>
                  <div className="creator-products-grid">
                    {products.map(p => (
                      <div key={p.id} className="creator-product-card glass-card">
                        <div className="creator-product-cover" style={{ background: `linear-gradient(135deg, ${p.cover}, #0a0a0f)` }}>
                          <span className="creator-product-category">{p.category.replace('-', ' ')}</span>
                        </div>
                        <div className="creator-product-body">
                          <div className="creator-product-name">{p.name}</div>
                          <p className="creator-product-desc">{p.description}</p>
                          <div className="creator-product-footer">
                            <div className="creator-product-stats">
                              <span>↓ {fmtNum(p.downloads)}</span>
                              <span>★ {p.rating.toFixed(1)}</span>
                            </div>
                            <span className={`price-badge ${p.price === 0 ? 'price-badge-free' : 'price-badge-paid'}`}>
                              {p.price === 0 ? 'Free' : `$${p.price.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Tiers sidebar */}
            <aside className="creator-tiers-sidebar">
              <div className="section-label">Subscribe</div>
              <div className="creator-tiers-list">
                {creator.tiers.map(tier => (
                  <div key={tier.name} className={`creator-tier-card glass-card${tier.highlight ? ' tier-highlight' : ''}`}>
                    {tier.highlight && <div className="tier-highlight-badge">Most Popular</div>}
                    <div className="tier-name">{tier.name}</div>
                    <div className="tier-price">
                      {tier.price === 0 ? (
                        <span className="tier-price-free">Free</span>
                      ) : (
                        <>
                          <span className="tier-price-amount">${tier.price.toFixed(2)}</span>
                          <span className="tier-price-period">/mo</span>
                        </>
                      )}
                    </div>
                    <ul className="tier-perks">
                      {tier.perks.map(perk => (
                        <li key={perk} className="tier-perk">
                          <span className="tier-perk-check">✓</span>
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <button
                      className={tier.highlight ? 'btn-primary tier-subscribe-btn' : 'btn-secondary tier-subscribe-btn'}
                      onClick={() => setSubscribedTier(tier.name)}
                    >
                      {subscribedTier === tier.name ? 'Subscribed ✓' : (tier.price === 0 ? 'Follow Free' : `Subscribe for $${tier.price.toFixed(2)}/mo`)}
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Back link ── */}
      <div className="container" style={{ paddingBottom: 48 }}>
        <Link to="/marketplace" className="creator-back-link">
          ← Back to Marketplace
        </Link>
      </div>

    </div>
  )
}

export default CreatorProfile

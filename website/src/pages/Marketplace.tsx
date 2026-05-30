import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './Marketplace.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  category: string
  creator: string
  creatorId: string
  price: number
  downloads: number
  likes: number
  rating: number
  tags: string[]
  bpm?: number
  bpmMax?: number
  featured?: boolean
  cover: string
  description: string
  isNew?: boolean
}

interface Creator {
  id: string
  slug: string
  name: string
  genre: string[]
  followers: number
  products: number
  avatar: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  { id: 'p1',  name: 'Dark Techno Kicks Vol.1',    category: 'kick',      creator: 'IRN Factory',     creatorId: 'c1', price: 9.99,  downloads: 2847, likes: 234, rating: 4.8, tags: ['Techno', 'Industrial', 'Hard'],   bpm: 130, bpmMax: 145, featured: true,  cover: '#1a0a2e', description: 'Hard-hitting industrial techno kicks built for the dancefloor.' },
  { id: 'p2',  name: 'Wannamaker Snares',           category: 'snare',     creator: 'Dark Collective', creatorId: 'c2', price: 0,     downloads: 8421, likes: 891, rating: 4.9, tags: ['Free', 'Trap', 'Hard'],           bpm: 140, bpmMax: 160, featured: true,  cover: '#0a1a2e', description: 'The iconic Wannamaker snare collection — free forever.' },
  { id: 'p3',  name: 'Serum Acid Bass Presets',     category: 'preset',    creator: 'SynthMaster',     creatorId: 'c3', price: 14.99, downloads: 1203, likes: 156, rating: 4.7, tags: ['Serum', 'Acid', 'Bass'],          bpm: 128, bpmMax: 140, featured: false, cover: '#1a2e0a', description: '60 acid bass presets for Xfer Serum, from subtle to face-melting.' },
  { id: 'p4',  name: 'Lofi Hip-Hop Template',       category: 'template',  creator: 'ChillWave',       creatorId: 'c4', price: 7.99,  downloads: 3102, likes: 412, rating: 4.6, tags: ['Lofi', 'Hip-Hop', 'Chill'],       bpm: 75,  bpmMax: 90,  featured: false, cover: '#2e1a0a', description: 'Full FL Studio lofi template ready to flip and release.' },
  { id: 'p5',  name: 'Modular Rack – Ambient FX',   category: 'rack',      creator: 'VoltLab',         creatorId: 'c5', price: 19.99, downloads: 892,  likes: 98,  rating: 4.5, tags: ['Modular', 'Ambient', 'Rack'],     bpm: 0,   bpmMax: 0,   featured: false, cover: '#0a2e1a', description: 'Curated modular rack patches for deep ambient textures.' },
  { id: 'p6',  name: 'UK Drill Strings Vol.2',      category: 'sample',    creator: 'Grimey Beats',    creatorId: 'c2', price: 11.99, downloads: 4509, likes: 567, rating: 4.8, tags: ['Drill', 'UK', 'Strings'],         bpm: 140, bpmMax: 145, featured: true,  cover: '#2e0a0a', description: 'Cinematic string loops and stabs for authentic UK drill production.' },
  { id: 'p7',  name: 'Future Bass Chords Pack',     category: 'sample',    creator: 'SynthMaster',     creatorId: 'c3', price: 0,     downloads: 11203,likes: 1456,rating: 4.9, tags: ['Free', 'Future Bass', 'Chords'],  bpm: 150, bpmMax: 160, featured: false, cover: '#0a2e2e', description: 'Lush future bass chord stabs — free for the community.', isNew: true },
  { id: 'p8',  name: '808 Sound Bank Pro',          category: 'sound-bank',creator: 'IRN Factory',     creatorId: 'c1', price: 24.99, downloads: 5671, likes: 734, rating: 4.7, tags: ['808', 'Bass', 'Trap'],            bpm: 135, bpmMax: 150, featured: true,  cover: '#1a1a2e', description: 'Over 200 tuned 808s engineered for maximum sub impact.' },
  { id: 'p9',  name: 'Phonk Horns & Vocals',        category: 'sample',    creator: 'ShadowBeat',      creatorId: 'c6', price: 8.99,  downloads: 6234, likes: 823, rating: 4.7, tags: ['Phonk', 'Horns', 'Vocals'],       bpm: 138, bpmMax: 148, featured: false, cover: '#2e2a0a', description: 'Classic phonk horns, vocal chops, and Memphis-inspired elements.' },
  { id: 'p10', name: 'Trap Hi-Hat Toolkit',         category: 'hat',       creator: 'Dark Collective', creatorId: 'c2', price: 5.99,  downloads: 3891, likes: 489, rating: 4.6, tags: ['Trap', 'Hi-Hat', 'Rolls'],        bpm: 130, bpmMax: 150, featured: false, cover: '#1e0a2e', description: '500+ trap hi-hat samples — open, closed, rolls, and shuffles.', isNew: true },
  { id: 'p11', name: 'Massive X Bass Presets',      category: 'preset',    creator: 'VoltLab',         creatorId: 'c5', price: 12.99, downloads: 987,  likes: 134, rating: 4.5, tags: ['Massive X', 'Bass', 'Dubstep'],   bpm: 140, bpmMax: 155, featured: false, cover: '#0a0a2e', description: '80 bass presets for Native Instruments Massive X.' },
  { id: 'p12', name: 'Afrobeats Percussion Kit',    category: 'sample',    creator: 'Lagos Sound',     creatorId: 'c7', price: 0,     downloads: 7122, likes: 912, rating: 4.9, tags: ['Free', 'Afrobeats', 'Percussion'],bpm: 100, bpmMax: 115, featured: false, cover: '#2e1a1a', description: 'Authentic Afrobeats shakers, congas, and talking drum loops.' },
  { id: 'p13', name: 'Cinematic Melody Loops',      category: 'melody',    creator: 'ChillWave',       creatorId: 'c4', price: 15.99, downloads: 2234, likes: 298, rating: 4.6, tags: ['Cinematic', 'Melody', 'Orchestral'],bpm: 85, bpmMax: 100, featured: false, cover: '#1e2e0a', description: 'Sweeping cinematic melody loops in multiple keys and tempos.' },
  { id: 'p14', name: 'Deep House Bass Lines',       category: 'bass',      creator: 'SoulGrid',        creatorId: 'c8', price: 9.99,  downloads: 1876, likes: 231, rating: 4.5, tags: ['House', 'Bass', 'Deep'],          bpm: 122, bpmMax: 130, featured: false, cover: '#0a1e2e', description: 'Groovy deep house basslines recorded live and DI.', isNew: true },
  { id: 'p15', name: 'Plugin Bundle – Mix FX',      category: 'plugin',    creator: 'VoltLab',         creatorId: 'c5', price: 29.99, downloads: 1542, likes: 198, rating: 4.4, tags: ['Plugin', 'FX', 'Mix'],            featured: false, cover: '#2e0a2e', description: 'Collection of AU/VST FX plugins for creative mixing and sound design.' },
  { id: 'p16', name: 'Snare Clap Collection',       category: 'snare',     creator: 'IRN Factory',     creatorId: 'c1', price: 6.99,  downloads: 3445, likes: 423, rating: 4.7, tags: ['Snare', 'Clap', 'Boom Bap'],      bpm: 90,  bpmMax: 100, featured: false, cover: '#0e1a2e', description: 'Classic boom bap snares and fat claps sampled from vintage hardware.' },
  { id: 'p17', name: 'Reggaeton Template',          category: 'template',  creator: 'Lagos Sound',     creatorId: 'c7', price: 11.99, downloads: 2891, likes: 367, rating: 4.6, tags: ['Reggaeton', 'Perreo', 'Latin'],   bpm: 95,  bpmMax: 100, featured: false, cover: '#2e1e0a', description: 'Full Ableton Live reggaeton/perreo template with dembow pattern.' },
  { id: 'p18', name: 'Trap Kick One-Shots',         category: 'kick',      creator: 'Grimey Beats',    creatorId: 'c2', price: 0,     downloads: 9087, likes: 1123,rating: 4.8, tags: ['Free', 'Trap', 'Kick'],           bpm: 130, bpmMax: 145, featured: false, cover: '#2e0e0a', description: 'Punchy trap kicks with sub presence — 200+ one-shots, free.' },
  { id: 'p19', name: 'Afro Melody Loops Vol.3',     category: 'melody',    creator: 'Lagos Sound',     creatorId: 'c7', price: 8.99,  downloads: 1654, likes: 214, rating: 4.5, tags: ['Afrobeats', 'Melody', 'Guitar'],  bpm: 100, bpmMax: 112, featured: false, cover: '#0a2e10', description: 'Afro-inspired guitar and keyboard melody loops at 100–112 BPM.', isNew: true },
  { id: 'p20', name: 'R&B Chord Progressions',      category: 'sample',    creator: 'SoulGrid',        creatorId: 'c8', price: 12.99, downloads: 2109, likes: 276, rating: 4.6, tags: ['R&B', 'Chords', 'Keys'],          bpm: 85,  bpmMax: 95,  featured: false, cover: '#1a0e2e', description: 'Neo-soul and modern R&B chord progressions in all 12 keys.' },
]

const CREATORS: Creator[] = [
  { id: 'c1', slug: 'irn-factory',     name: 'IRN Factory',     genre: ['Techno', 'Industrial', 'EBM'],      followers: 12400, products: 18, avatar: '#7c3aed' },
  { id: 'c2', slug: 'dark-collective', name: 'Dark Collective',  genre: ['Trap', 'Drill', 'Phonk'],           followers: 28900, products: 31, avatar: '#0891b2' },
  { id: 'c3', slug: 'synthmaster',     name: 'SynthMaster',      genre: ['Future Bass', 'Dubstep', 'Synth'],  followers: 9800,  products: 22, avatar: '#059669' },
]

const CATEGORIES = ['All', 'Kicks', 'Hats', 'Snares', 'Presets', 'Templates', 'Racks', 'Plugins', 'Samples', 'Sound Banks', 'Melodies', 'Bass']

const CATEGORY_MAP: Record<string, string> = {
  'Kicks': 'kick', 'Hats': 'hat', 'Snares': 'snare', 'Presets': 'preset',
  'Templates': 'template', 'Racks': 'rack', 'Plugins': 'plugin', 'Samples': 'sample',
  'Sound Banks': 'sound-bank', 'Melodies': 'melody', 'Bass': 'bass',
}

const GENRES = ['Trap', 'Techno', 'Drill', 'House', 'R&B', 'Afrobeats', 'Future Bass', 'Phonk', 'Lofi']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, string> = {
    kick: '🥁', hat: '🎩', snare: '🔥', preset: '🎛', template: '📋',
    rack: '🔌', plugin: '⚡', sample: '🎵', 'sound-bank': '📦', melody: '🎶', bass: '🎸',
  }
  return <span className="product-card-icon">{icons[category] ?? '🎵'}</span>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriceBadge({ price }: { price: number }) {
  if (price === 0) return <span className="price-badge price-badge-free">Free</span>
  return <span className="price-badge price-badge-paid">${price.toFixed(2)}</span>
}

function StatRow({ downloads, likes, rating, liked, onLike }: {
  downloads: number; likes: number; rating: number; liked: boolean; onLike: () => void
}) {
  return (
    <div className="stat-row">
      <span className="stat-item"><span className="stat-icon">↓</span>{fmtNum(downloads)}</span>
      <button className={`like-btn${liked ? ' like-btn-active' : ''}`} onClick={onLike} aria-label="Like">
        <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {fmtNum(likes)}
      </button>
      <span className="stat-item"><span className="stat-icon">★</span>{rating.toFixed(1)}</span>
    </div>
  )
}

function ProductCard({ product, liked, downloaded, onLike, onGet }: {
  product: Product
  liked: boolean
  downloaded: boolean
  onLike: () => void
  onGet: () => void
}) {
  return (
    <div className="product-card glass-card">
      <div className="product-card-cover" style={{ background: `linear-gradient(135deg, ${product.cover}, #0a0a0f)` }}>
        <CategoryIcon category={product.category} />
        <span className="product-card-category">{product.category.replace('-', ' ')}</span>
        {product.isNew && <span className="product-card-new">New</span>}
        <div className="preview-overlay">
          <button className="preview-play-btn">Preview ▶</button>
        </div>
      </div>
      <div className="product-card-body">
        <div className="product-card-header">
          <div>
            <div className="product-card-name">{product.name}</div>
            <Link to={`/creator/${product.creatorId}`} className="product-card-creator">{product.creator}</Link>
          </div>
          <PriceBadge price={product.price} />
        </div>
        <p className="product-card-desc">{product.description}</p>
        <StatRow
          downloads={product.downloads}
          likes={product.likes}
          rating={product.rating}
          liked={liked}
          onLike={onLike}
        />
        <div className="product-card-tags">
          {product.tags.slice(0, 3).map(t => <span key={t} className="pack-tag">{t}</span>)}
        </div>
        <button
          className={product.price === 0 ? (downloaded ? 'btn-secondary product-get-btn downloaded' : 'btn-secondary product-get-btn') : 'btn-primary product-get-btn'}
          onClick={onGet}
        >
          {product.price === 0
            ? (downloaded ? 'Downloaded ✓' : 'Get Free')
            : (downloaded ? 'In Library ✓' : `Purchase ($${product.price.toFixed(2)})`)}
        </button>
      </div>
    </div>
  )
}

function TrendingCard({ product, liked, downloaded, onLike, onGet }: {
  product: Product
  liked: boolean
  downloaded: boolean
  onLike: () => void
  onGet: () => void
}) {
  return (
    <div className="trending-card glass-card">
      <div className="trending-card-cover" style={{ background: `linear-gradient(135deg, ${product.cover}, #0a0a0f)` }}>
        <CategoryIcon category={product.category} />
        <PriceBadge price={product.price} />
      </div>
      <div className="trending-card-body">
        <div className="trending-card-name">{product.name}</div>
        <div className="trending-card-creator">
          <span className="creator-avatar-xs" style={{ background: `hsl(${product.creatorId.charCodeAt(1) * 40}, 60%, 35%)` }}>
            {product.creator[0]}
          </span>
          {product.creator}
        </div>
        <StatRow
          downloads={product.downloads}
          likes={product.likes}
          rating={product.rating}
          liked={liked}
          onLike={onLike}
        />
        <div className="trending-card-actions">
          <button className="btn-secondary trending-preview-btn">Preview</button>
          <button
            className="btn-primary trending-get-btn"
            onClick={onGet}
          >
            {downloaded ? '✓' : 'Get'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Marketplace() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('trending')
  const [priceFilter, setPriceFilter] = useState('all')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [bpmMin, setBpmMin] = useState('')
  const [bpmMax, setBpmMax] = useState('')
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set())
  const [downloadedProducts, setDownloadedProducts] = useState<Set<string>>(new Set())
  const [localLikes, setLocalLikes] = useState<Record<string, number>>({})
  void localLikes  // used via setLocalLikes to sync counts; read in card via localLikes[id]

  // ─── Derived state ─────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let list = [...PRODUCTS]

    // Category filter
    if (activeCategory !== 'All') {
      const catKey = CATEGORY_MAP[activeCategory]
      if (catKey) list = list.filter(p => p.category === catKey)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Price filter
    if (priceFilter === 'free')    list = list.filter(p => p.price === 0)
    if (priceFilter === 'under10') list = list.filter(p => p.price > 0 && p.price < 10)
    if (priceFilter === '10to25')  list = list.filter(p => p.price >= 10 && p.price <= 25)
    if (priceFilter === '25plus')  list = list.filter(p => p.price > 25)

    // Genre filter
    if (selectedGenres.length > 0) {
      list = list.filter(p => p.tags.some(t => selectedGenres.includes(t)))
    }

    // BPM filter
    const bMin = parseInt(bpmMin)
    const bMax = parseInt(bpmMax)
    if (!isNaN(bMin)) list = list.filter(p => (p.bpm ?? 0) >= bMin)
    if (!isNaN(bMax)) list = list.filter(p => (p.bpmMax ?? p.bpm ?? 999) <= bMax)

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'trending')   return (b.downloads + b.likes * 3) - (a.downloads + a.likes * 3)
      if (sortBy === 'newest')     return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
      if (sortBy === 'popular')    return b.likes - a.likes
      if (sortBy === 'free-first') return a.price - b.price
      if (sortBy === 'price-asc')  return a.price - b.price
      if (sortBy === 'price-desc') return b.price - a.price
      return 0
    })

    return list
  }, [activeCategory, searchQuery, sortBy, priceFilter, selectedGenres, bpmMin, bpmMax])

  const trendingProducts = useMemo(() =>
    [...PRODUCTS].sort((a, b) => (b.downloads + b.likes * 3) - (a.downloads + a.likes * 3)).slice(0, 6),
    []
  )

  const newestProducts = useMemo(() =>
    PRODUCTS.filter(p => p.isNew).slice(0, 3),
    []
  )

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleLike(id: string) {
    setLikedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLocalLikes(prev => {
      const base = PRODUCTS.find(p => p.id === id)?.likes ?? 0
      const isLiked = likedProducts.has(id)
      return { ...prev, [id]: isLiked ? base : base + 1 }
    })
  }

  function handleGet(id: string) {
    setDownloadedProducts(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function toggleGenre(genre: string) {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="marketplace-page">

      {/* ── Hero ── */}
      <div className="marketplace-hero">
        <div className="marketplace-hero-bg" aria-hidden="true">
          <div className="mp-orb-1" />
          <div className="mp-orb-2" />
        </div>
        <div className="container">
          <div className="section-label">The Creative Marketplace</div>
          <h1 className="marketplace-title">
            Discover the&nbsp;<span className="gradient-text">Marketplace</span>
          </h1>
          <p className="marketplace-subtitle">
            Discover kicks, presets, templates, and sample packs crafted by top producers
          </p>
        </div>
      </div>

      {/* ── Category Bar ── */}
      <div className="category-bar-wrap">
        <div className="container">
          <div className="category-bar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`category-pill${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trending Section ── */}
      <section className="trending-section">
        <div className="container">
          <div className="trending-header">
            <div className="section-label">Trending Now</div>
          </div>
          <div className="trending-scroll">
            {trendingProducts.map(p => (
              <TrendingCard
                key={p.id}
                product={p}
                liked={likedProducts.has(p.id)}
                downloaded={downloadedProducts.has(p.id)}
                onLike={() => handleLike(p.id)}
                onGet={() => handleGet(p.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Creators ── */}
      <section className="featured-creators-section">
        <div className="container">
          <div className="section-label">Featured Creators</div>
          <div className="featured-creators-grid">
            {CREATORS.map(creator => (
              <div key={creator.id} className="creator-card-mini glass-card">
                <div className="creator-card-avatar" style={{ background: creator.avatar }}>
                  {creator.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="creator-card-info">
                  <div className="creator-card-name">
                    {creator.name}
                    <span className="creator-verified" title="Verified">✓</span>
                  </div>
                  <div className="creator-card-genres">
                    {creator.genre.map(g => <span key={g} className="pack-tag">{g}</span>)}
                  </div>
                  <div className="creator-card-stats">
                    <span>{fmtNum(creator.followers)} followers</span>
                    <span>{creator.products} products</span>
                  </div>
                </div>
                <Link to={`/creator/${creator.slug}`} className="btn-secondary creator-card-link">
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Layout: Sidebar + Grid ── */}
      <section className="section-sm marketplace-section">
        <div className="container">
          <div className="marketplace-layout">

            {/* Sidebar */}
            <aside className="marketplace-sidebar glass-card">
              <div className="filter-section">
                <div className="filter-label">Search</div>
                <input
                  type="text"
                  className="filter-search"
                  placeholder="Name, tag, creator..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-section">
                <div className="filter-label">Sort By</div>
                <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="trending">Trending</option>
                  <option value="newest">Newest</option>
                  <option value="popular">Most Popular</option>
                  <option value="free-first">Free First</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                </select>
              </div>

              <div className="filter-section">
                <div className="filter-label">Price</div>
                {(['all', 'free', 'under10', '10to25', '25plus'] as const).map(opt => {
                  const labels: Record<string, string> = {
                    all: 'All prices', free: 'Free', under10: 'Under $10', '10to25': '$10 – $25', '25plus': '$25+',
                  }
                  return (
                    <label key={opt} className="filter-radio">
                      <input
                        type="radio"
                        name="price"
                        value={opt}
                        checked={priceFilter === opt}
                        onChange={() => setPriceFilter(opt)}
                      />
                      <span>{labels[opt]}</span>
                    </label>
                  )
                })}
              </div>

              <div className="filter-section">
                <div className="filter-label">Genre</div>
                {GENRES.map(genre => (
                  <label key={genre} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedGenres.includes(genre)}
                      onChange={() => toggleGenre(genre)}
                    />
                    <span>{genre}</span>
                  </label>
                ))}
              </div>

              <div className="filter-section">
                <div className="filter-label">BPM Range</div>
                <div className="filter-bpm-row">
                  <input
                    type="number"
                    className="filter-bpm-input"
                    placeholder="Min"
                    value={bpmMin}
                    onChange={e => setBpmMin(e.target.value)}
                    min={0}
                    max={300}
                  />
                  <span className="filter-bpm-dash">–</span>
                  <input
                    type="number"
                    className="filter-bpm-input"
                    placeholder="Max"
                    value={bpmMax}
                    onChange={e => setBpmMax(e.target.value)}
                    min={0}
                    max={300}
                  />
                </div>
              </div>

              {(searchQuery || priceFilter !== 'all' || selectedGenres.length > 0 || bpmMin || bpmMax) && (
                <button
                  className="filter-clear-btn"
                  onClick={() => {
                    setSearchQuery('')
                    setPriceFilter('all')
                    setSelectedGenres([])
                    setBpmMin('')
                    setBpmMax('')
                  }}
                >
                  Clear Filters
                </button>
              )}
            </aside>

            {/* Product Grid */}
            <div className="product-grid-wrap">
              <div className="product-grid-meta">
                <span className="product-grid-count">{filteredProducts.length} products</span>
              </div>
              {filteredProducts.length === 0 ? (
                <div className="product-grid-empty">
                  <div className="product-grid-empty-icon">🎵</div>
                  <div className="product-grid-empty-text">No products match your filters.</div>
                  <button className="btn-secondary" onClick={() => {
                    setActiveCategory('All')
                    setSearchQuery('')
                    setPriceFilter('all')
                    setSelectedGenres([])
                    setBpmMin('')
                    setBpmMax('')
                  }}>Reset Filters</button>
                </div>
              ) : (
                <div className="product-grid">
                  {filteredProducts.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      liked={likedProducts.has(p.id)}
                      downloaded={downloadedProducts.has(p.id)}
                      onLike={() => handleLike(p.id)}
                      onGet={() => handleGet(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── What's New ── */}
      {newestProducts.length > 0 && (
        <section className="whats-new-section">
          <div className="container">
            <div className="section-label">What's New</div>
            <div className="whats-new-strip">
              {newestProducts.map(p => (
                <div key={p.id} className="whats-new-card glass-card">
                  <div className="whats-new-cover" style={{ background: `linear-gradient(135deg, ${p.cover}, #0a0a0f)` }}>
                    <CategoryIcon category={p.category} />
                    <span className="product-card-new">New</span>
                  </div>
                  <div className="whats-new-body">
                    <div className="product-card-name">{p.name}</div>
                    <div className="product-card-creator">{p.creator}</div>
                    <div className="whats-new-footer">
                      <PriceBadge price={p.price} />
                      <button
                        className="btn-primary product-get-btn"
                        onClick={() => handleGet(p.id)}
                      >
                        {downloadedProducts.has(p.id) ? '✓' : 'Get'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="section mp-cta-section">
        <div className="container">
          <div className="mp-cta glass-card">
            <div className="mp-cta-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="19" stroke="var(--purple)" strokeWidth="1.5" />
                <path d="M20 12v16M12 20h16" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="mp-cta-title">Sell your sounds</h2>
            <p className="mp-cta-desc">
              Are you a producer? Upload your packs, presets, and templates. Keep 70% of every sale.
            </p>
            <Link to="/creator-dashboard" className="btn-primary">Become a Creator</Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default Marketplace

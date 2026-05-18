import { useState } from 'react'
import './Marketplace.css'

interface Pack {
  id: number
  name: string
  genre: string
  producer: string
  price: string
  originalPrice?: string
  samples: number
  bpm: string
  tags: string[]
  featured?: boolean
  new?: boolean
  free?: boolean
}

const packs: Pack[] = [
  { id: 1, name: 'Midnight Trap Vol. 1', genre: 'Trap', producer: 'NeuroTek Labs', price: '$9.99', samples: 120, bpm: '130–145', tags: ['808s', 'Hi-hats', 'Melodies'], featured: true },
  { id: 2, name: 'Lofi Dreams', genre: 'Lo-Fi', producer: 'ChillWave Studio', price: '$7.99', samples: 85, bpm: '70–90', tags: ['Chops', 'Vinyl', 'Keys'], new: true },
  { id: 3, name: 'Future Bass Starter', genre: 'Future Bass', producer: 'NeuroTek Labs', price: 'Free', samples: 40, bpm: '150–160', tags: ['Synths', 'Chords', 'FX'], free: true },
  { id: 4, name: 'Dark Phonk', genre: 'Phonk', producer: 'ShadowBeat', price: '$12.99', originalPrice: '$18.99', samples: 200, bpm: '135–150', tags: ['808s', 'Horns', 'Drums'] },
  { id: 5, name: 'Afrobeats Essential', genre: 'Afrobeats', producer: 'Lagos Sound', price: '$9.99', samples: 95, bpm: '100–115', tags: ['Percussion', 'Flutes', 'Bass'] },
  { id: 6, name: 'UK Drill Toolkit', genre: 'Drill', producer: 'Grimey Beats', price: '$11.99', samples: 150, bpm: '140–145', tags: ['Strings', 'Slides', 'Kicks'], new: true },
  { id: 7, name: 'Chill R&B Vol. 2', genre: 'R&B', producer: 'SoulGrid', price: '$8.99', samples: 75, bpm: '85–100', tags: ['Keys', 'Guitar', 'Pads'] },
  { id: 8, name: 'Techno Industrial', genre: 'Techno', producer: 'IRN Factory', price: '$13.99', samples: 180, bpm: '130–145', tags: ['Kicks', 'Synths', 'FX'] },
  { id: 9, name: 'Bedroom Pop Kit', genre: 'Pop', producer: 'NeuroTek Labs', price: 'Free', samples: 30, bpm: '100–120', tags: ['Guitar', 'Drums', 'Bells'], free: true },
]

const genres = ['All', 'Trap', 'Lo-Fi', 'Future Bass', 'Phonk', 'Afrobeats', 'Drill', 'R&B', 'Techno', 'Pop']

function Marketplace() {
  const [activeGenre, setActiveGenre] = useState('All')
  const [sortBy, setSortBy] = useState('featured')

  const filtered = packs
    .filter(p => activeGenre === 'All' || p.genre === activeGenre)
    .sort((a, b) => {
      if (sortBy === 'price-asc') {
        const pa = a.price === 'Free' ? 0 : parseFloat(a.price.replace('$', ''))
        const pb = b.price === 'Free' ? 0 : parseFloat(b.price.replace('$', ''))
        return pa - pb
      }
      if (sortBy === 'samples') return b.samples - a.samples
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
    })

  return (
    <div className="marketplace-page">
      <div className="marketplace-hero">
        <div className="marketplace-hero-bg" aria-hidden="true"><div className="mp-orb-1" /><div className="mp-orb-2" /></div>
        <div className="container">
          <div className="section-label">Packs Marketplace</div>
          <h1 className="marketplace-title">Sample packs built for <span className="gradient-text">NeuroTek AI</span></h1>
          <p className="marketplace-subtitle">Curated loops, one-shots, and MIDI files — drag and drop directly into your projects.</p>
          <div className="mp-stats">
            <div className="mp-stat"><span className="mp-stat-value">400+</span><span className="mp-stat-label">Packs</span></div>
            <div className="mp-stat"><span className="mp-stat-value">50k+</span><span className="mp-stat-label">Samples</span></div>
            <div className="mp-stat"><span className="mp-stat-value">Free</span><span className="mp-stat-label">Starter packs</span></div>
          </div>
        </div>
      </div>

      <section className="section marketplace-main">
        <div className="container">
          <div className="marketplace-toolbar">
            <div className="genre-filters">
              {genres.map(g => (
                <button key={g} className={`genre-btn${activeGenre === g ? ' active' : ''}`} onClick={() => setActiveGenre(g)}>{g}</button>
              ))}
            </div>
            <select className="mp-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="samples">Most Samples</option>
            </select>
          </div>

          <div className="packs-grid">
            {filtered.map(pack => (
              <div key={pack.id} className={`pack-card glass-card${pack.featured ? ' pack-featured' : ''}`}>
                <div className="pack-cover">
                  <div className="pack-cover-bg" style={{ background: `linear-gradient(135deg, hsl(${pack.id * 40}, 60%, 20%), hsl(${pack.id * 40 + 60}, 70%, 15%))` }} />
                  <div className="pack-cover-content">
                    <span className="pack-genre-badge">{pack.genre}</span>
                    <div className="pack-cover-title">{pack.name}</div>
                  </div>
                  {pack.new && <span className="pack-new-badge">New</span>}
                  {pack.featured && <span className="pack-featured-badge">Featured</span>}
                </div>
                <div className="pack-info">
                  <div className="pack-meta">
                    <span className="pack-producer">{pack.producer}</span>
                    <span className="pack-samples">{pack.samples} samples</span>
                  </div>
                  <div className="pack-bpm">BPM: {pack.bpm}</div>
                  <div className="pack-tags">{pack.tags.map(t => <span key={t} className="pack-tag">{t}</span>)}</div>
                  <div className="pack-footer">
                    <div className="pack-price-block">
                      <span className={`pack-price${pack.free ? ' pack-price-free' : ''}`}>{pack.price}</span>
                      {pack.originalPrice && <span className="pack-original-price">{pack.originalPrice}</span>}
                    </div>
                    <button className={pack.free ? 'btn-secondary pack-btn' : 'btn-primary pack-btn'}>
                      {pack.free ? 'Download Free' : 'Add to Library'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section mp-cta-section">
        <div className="container">
          <div className="mp-cta glass-card">
            <div className="mp-cta-icon"><svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="19" stroke="var(--purple)" strokeWidth="1.5" /><path d="M20 12v16M12 20h16" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" /></svg></div>
            <h2 className="mp-cta-title">Submit your pack</h2>
            <p className="mp-cta-desc">Are you a producer? Submit your sample packs for review. Earn royalties on every sale.</p>
            <a href="#" className="btn-primary">Apply as a Creator</a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Marketplace

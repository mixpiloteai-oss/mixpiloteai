import './Merch.css'

interface MerchItem {
  id: number
  name: string
  price: string
  category: string
  sizes?: string[]
  colors?: string[]
  badge?: string
}

const items: MerchItem[] = [
  { id: 1, name: 'NeuroTek AI Logo Tee', price: '$29', category: 'Apparel', sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: ['Black', 'White'], badge: 'Bestseller' },
  { id: 2, name: 'DAW Producer Hoodie', price: '$59', category: 'Apparel', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Charcoal'] },
  { id: 3, name: 'Neon Circuit Cap', price: '$34', category: 'Accessories', colors: ['Black', 'Navy'] },
  { id: 4, name: 'Studio Desk Mat XL', price: '$44', category: 'Studio', badge: 'New' },
  { id: 5, name: 'NeuroTek Enamel Pin Set', price: '$14', category: 'Accessories', badge: 'New' },
  { id: 6, name: 'Matte Sticker Pack', price: '$8', category: 'Accessories' },
  { id: 7, name: 'Producer Notebook A5', price: '$19', category: 'Studio' },
  { id: 8, name: 'Logo Crewneck Sweatshirt', price: '$54', category: 'Apparel', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black'] },
]

const gradients = [
  'linear-gradient(135deg, #1a1030 0%, #0d1f3c 100%)',
  'linear-gradient(135deg, #1a2030 0%, #0d1a2c 100%)',
  'linear-gradient(135deg, #0d1a2c 0%, #1a1030 100%)',
  'linear-gradient(135deg, #1c1c2e 0%, #12101e 100%)',
]

function Merch() {
  return (
    <div className="merch-page">
      <div className="merch-hero">
        <div className="merch-hero-bg" aria-hidden="true"><div className="merch-orb-1" /><div className="merch-orb-2" /></div>
        <div className="container">
          <div className="section-label">Official Store</div>
          <h1 className="merch-title">NeuroTek <span className="gradient-text">Merch</span></h1>
          <p className="merch-subtitle">Wear your sound. Official NeuroTek AI gear for producers.</p>
        </div>
      </div>

      <section className="section merch-main">
        <div className="container">
          <div className="merch-grid">
            {items.map((item, i) => (
              <div key={item.id} className="merch-card glass-card">
                <div className="merch-img" style={{ background: gradients[i % gradients.length] }}>
                  <div className="merch-img-logo">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect width="48" height="48" rx="12" fill="rgba(167,139,250,0.1)" />
                      <rect x="8" y="8" width="14" height="14" rx="2" fill="var(--purple)" opacity="0.7" />
                      <rect x="26" y="8" width="14" height="14" rx="2" fill="var(--purple)" opacity="0.7" />
                      <rect x="8" y="26" width="14" height="14" rx="2" fill="var(--purple)" opacity="0.7" />
                      <rect x="26" y="26" width="14" height="14" rx="2" fill="var(--purple)" opacity="0.7" />
                    </svg>
                  </div>
                  {item.badge && <span className="merch-badge">{item.badge}</span>}
                </div>
                <div className="merch-info">
                  <span className="merch-category">{item.category}</span>
                  <h3 className="merch-name">{item.name}</h3>
                  {item.sizes && (
                    <div className="merch-sizes">
                      {item.sizes.map(s => <span key={s} className="merch-size">{s}</span>)}
                    </div>
                  )}
                  {item.colors && (
                    <div className="merch-colors">
                      {item.colors.map(c => <span key={c} className="merch-color-label">{c}</span>)}
                    </div>
                  )}
                  <div className="merch-footer">
                    <span className="merch-price">{item.price}</span>
                    <button className="btn-primary merch-btn">Add to Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm merch-cta-section">
        <div className="container">
          <div className="merch-cta">
            <h2>Free shipping on orders <span className="gradient-text">over $75</span></h2>
            <p>Ships worldwide. All items are made to order.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Merch

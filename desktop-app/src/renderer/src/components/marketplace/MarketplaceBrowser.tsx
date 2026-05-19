import React, { useState } from 'react'
import { useMarketplace } from '../../hooks/useMarketplace'
import type { MarketProduct, ProductCategory, InstalledPack, ActiveDownload } from '../../store/marketplaceStore'

// ─── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:         '#08080f',
  card:       '#0c0c14',
  border:     '#1c1c2e',
  purple:     '#7c3aed',
  purpleLight:'#a855f7',
  cyan:       '#06b6d4',
  text:       '#e2e8f0',
  muted:      '#475569',
  green:      '#10b981',
  red:        '#ef4444',
  pink:       '#ec4899',
} as const

// ─── Category config ────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<ProductCategory, string> = {
  kick:      '🥁',
  hat:       '🎩',
  snare:     '💥',
  perc:      '🪘',
  preset:    '🎛',
  template:  '📐',
  rack:      '🗄',
  plugin:    '🔌',
  sample:    '🎵',
  soundbank: '📦',
  melody:    '🎼',
  bass:      '🎸',
}

const CATEGORIES: { id: ProductCategory | 'all'; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'kick',      label: 'Kicks' },
  { id: 'hat',       label: 'Hats' },
  { id: 'snare',     label: 'Snares' },
  { id: 'preset',    label: 'Presets' },
  { id: 'template',  label: 'Templates' },
  { id: 'rack',      label: 'Racks' },
  { id: 'plugin',    label: 'Plugins' },
  { id: 'sample',    label: 'Samples' },
  { id: 'soundbank', label: 'Sound Banks' },
  { id: 'melody',    label: 'Melodies' },
  { id: 'bass',      label: 'Bass' },
]

const SORT_OPTIONS: { value: 'trending' | 'newest' | 'popular' | 'free' | 'price-asc'; label: string }[] = [
  { value: 'trending',   label: 'Trending' },
  { value: 'newest',     label: 'Newest' },
  { value: 'popular',    label: 'Popular' },
  { value: 'free',       label: 'Free' },
  { value: 'price-asc',  label: 'Price ↑' },
]

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Category gradient helper ──────────────────────────────────────────────────
function categoryGradient(cat: ProductCategory): string {
  const MAP: Record<ProductCategory, string> = {
    kick:      'linear-gradient(135deg,#7c3aed,#4c1d95)',
    hat:       'linear-gradient(135deg,#06b6d4,#0e7490)',
    snare:     'linear-gradient(135deg,#ec4899,#9d174d)',
    perc:      'linear-gradient(135deg,#f59e0b,#92400e)',
    preset:    'linear-gradient(135deg,#10b981,#065f46)',
    template:  'linear-gradient(135deg,#a855f7,#6b21a8)',
    rack:      'linear-gradient(135deg,#475569,#1e293b)',
    plugin:    'linear-gradient(135deg,#3b82f6,#1e3a8a)',
    sample:    'linear-gradient(135deg,#14b8a6,#134e4a)',
    soundbank: 'linear-gradient(135deg,#f97316,#7c2d12)',
    melody:    'linear-gradient(135deg,#8b5cf6,#4c1d95)',
    bass:      'linear-gradient(135deg,#06b6d4,#7c3aed)',
  }
  return MAP[cat]
}

// ─── Product Card ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: MarketProduct
  download?: ActiveDownload
  liked: boolean
  onLike: () => void
  onDownload: () => void
  compact?: boolean
}

function ProductCard({ product, download, liked, onLike, onDownload, compact = false }: ProductCardProps): React.ReactElement {
  const isFree = product.price === 0
  const status = download?.status ?? 'idle'

  function renderDownloadBtn(): React.ReactElement {
    if (status === 'downloading') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
            <div style={{ width: `${download?.progress ?? 0}%`, height: '100%', background: C.purple, borderRadius: 2, transition: 'width 0.2s' }} />
          </div>
          <span style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>{download?.progress ?? 0}%</span>
        </div>
      )
    }
    if (status === 'installing') {
      return <span style={{ fontSize: 11, color: C.cyan }}>Installing…</span>
    }
    if (status === 'done') {
      return <span style={{ fontSize: 11, color: C.green }}>Installed ✓</span>
    }
    if (status === 'error') {
      return (
        <button onClick={onDownload} style={{ fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Retry
        </button>
      )
    }
    // idle
    return (
      <button
        onClick={onDownload}
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: isFree ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.2)',
          color: isFree ? C.green : C.purpleLight,
          whiteSpace: 'nowrap',
        }}
      >
        {isFree ? 'Get' : `⬇ $${product.price.toFixed(2)}`}
      </button>
    )
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: compact ? 10 : 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
      width: compact ? 180 : undefined,
      minWidth: compact ? 180 : undefined,
    }}>
      {/* Cover */}
      <div style={{
        height: 64,
        borderRadius: 8,
        background: categoryGradient(product.category),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        flexShrink: 0,
      }}>
        {CATEGORY_ICONS[product.category]}
      </div>

      {/* Name + creator */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </p>
        <p style={{ fontSize: 11, color: C.muted, margin: 0, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.creatorName}
        </p>
      </div>

      {/* Price badge */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
          background: product.price === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)',
          color: product.price === 0 ? C.green : C.purpleLight,
        }}>
          {product.price === 0 ? 'Free' : `$${product.price.toFixed(2)}`}
        </span>
        {product.bpm && (
          <span style={{ fontSize: 10, color: C.muted }}>{product.bpm} BPM</span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.muted }}>↓ {product.downloads.toLocaleString()}</span>
        <span style={{ fontSize: 10, color: C.muted }}>♥ {product.likes.toLocaleString()}</span>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {product.tags.slice(0, 2).map((tag) => (
          <span key={tag} style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.05)', color: C.muted,
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <button
          onClick={onLike}
          style={{
            fontSize: 14, background: 'none', border: 'none', cursor: 'pointer',
            color: liked ? C.purple : C.muted, padding: 0, lineHeight: 1,
          }}
          title={liked ? 'Unlike' : 'Like'}
        >
          ♥
        </button>
        {renderDownloadBtn()}
      </div>
    </div>
  )
}

// ─── Horizontal scroll row ─────────────────────────────────────────────────────
interface ScrollRowProps {
  title: string
  products: MarketProduct[]
  downloads: ActiveDownload[]
  likedIds: Set<string>
  onLike: (id: string) => void
  onDownload: (p: MarketProduct) => void
}

function ScrollRow({ title, products, downloads, likedIds, onLike, onDownload }: ScrollRowProps): React.ReactElement {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 10px 0' }}>{title}</p>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6,
        scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            download={downloads.find((d) => d.productId === p.id)}
            liked={likedIds.has(p.id)}
            onLike={() => onLike(p.id)}
            onDownload={() => onDownload(p)}
            compact
          />
        ))}
        {products.length === 0 && (
          <p style={{ fontSize: 12, color: C.muted }}>No products available.</p>
        )}
      </div>
    </div>
  )
}

// ─── Library Tab ────────────────────────────────────────────────────────────────
interface LibraryTabProps {
  installed: InstalledPack[]
  onUninstall: (id: string) => void
  onOpenInBrowser: (pack: InstalledPack) => void
}

function LibraryTab({ installed, onUninstall, onOpenInBrowser }: LibraryTabProps): React.ReactElement {
  if (installed.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 200, gap: 12, color: C.muted }}>
        <span style={{ fontSize: 32 }}>📦</span>
        <p style={{ fontSize: 13, margin: 0 }}>No installed packs yet.</p>
        <p style={{ fontSize: 11, margin: 0 }}>Browse Discover to get started.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {installed.map((pack) => (
        <div key={pack.productId} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: categoryGradient(pack.category),
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {CATEGORY_ICONS[pack.category]}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pack.name}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(124,58,237,0.15)', color: C.purpleLight }}>
                {pack.category}
              </span>
              <span style={{ fontSize: 10, color: C.muted }}>{pack.fileCount} files</span>
              <span style={{ fontSize: 10, color: C.muted }}>{formatSize(pack.size)}</span>
              <span style={{ fontSize: 10, color: C.muted }}>Installed {formatDate(pack.installedAt)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => onOpenInBrowser(pack)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                background: 'rgba(6,182,212,0.1)', border: `1px solid rgba(6,182,212,0.25)`,
                color: C.cyan, cursor: 'pointer',
              }}
            >
              Open in Browser
            </button>
            <button
              onClick={() => onUninstall(pack.productId)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.25)`,
                color: C.red, cursor: 'pointer',
              }}
            >
              🗑 Uninstall
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Downloads Tab ──────────────────────────────────────────────────────────────
interface DownloadsTabProps {
  downloads: ActiveDownload[]
}

function DownloadsTab({ downloads }: DownloadsTabProps): React.ReactElement {
  if (downloads.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 200, gap: 12, color: C.muted }}>
        <span style={{ fontSize: 32 }}>⬇</span>
        <p style={{ fontSize: 13, margin: 0 }}>No downloads yet.</p>
      </div>
    )
  }

  function statusColor(status: ActiveDownload['status']): string {
    if (status === 'done') return C.green
    if (status === 'error') return C.red
    if (status === 'installing') return C.cyan
    return C.purple
  }

  function statusLabel(d: ActiveDownload): string {
    if (d.status === 'done') return 'Installed ✓'
    if (d.status === 'error') return d.error ?? 'Error'
    if (d.status === 'installing') return 'Installing…'
    if (d.status === 'downloading') return `${d.progress}%`
    return 'Idle'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {downloads.map((dl) => (
        <div key={dl.productId} style={{
          padding: '12px 16px', background: C.card,
          border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{dl.name}</p>
            <span style={{ fontSize: 11, color: statusColor(dl.status), fontWeight: 600 }}>
              {statusLabel(dl)}
            </span>
          </div>
          {(dl.status === 'downloading' || dl.status === 'installing') && (
            <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
              <div style={{
                width: `${dl.status === 'installing' ? 100 : dl.progress}%`,
                height: '100%',
                background: dl.status === 'installing' ? C.cyan : C.purple,
                borderRadius: 2,
                transition: 'width 0.2s',
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MarketplaceBrowser(): React.ReactElement {
  const {
    filteredProducts,
    featured,
    trending,
    installed,
    downloads,
    likedIds,
    loading,
    error,
    searchQuery,
    activeCategory,
    sortBy,
    setSearch,
    setCategory,
    setSort,
    downloadPack,
    uninstallPack,
    toggleLike,
    refresh,
  } = useMarketplace()

  const [activeTab, setActiveTab] = useState<'discover' | 'library' | 'downloads'>('discover')

  const activeDownloads = downloads.filter((d) => d.status === 'downloading' || d.status === 'installing')

  // Category counts
  function categoryCount(id: ProductCategory | 'all'): number {
    if (id === 'all') return filteredProducts.length
    return filteredProducts.filter((p) => p.category === id).length
  }

  // Connection status: simple online check
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine

  return (
    <div style={{ display: 'flex', height: '100%', background: C.bg, overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0a0a12', borderRight: `1px solid ${C.border}`, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Marketplace</span>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? C.green : C.red,
            }} title={isOnline ? 'Connected' : 'Offline'} />
          </div>
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packs, creators…"
            style={{
              width: '100%', boxSizing: 'border-box',
              fontSize: 11, padding: '6px 10px', borderRadius: 7, outline: 'none',
              background: '#0f0f1a', border: `1px solid ${C.border}`,
              color: C.text, caretColor: C.purple,
            }}
          />
        </div>

        {/* Categories */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px',
          scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.08em', margin: '0 0 8px 4px' }}>
            Categories
          </p>
          {CATEGORIES.map(({ id, label }) => {
            const active = activeCategory === id
            const count = categoryCount(id)
            return (
              <button
                key={id}
                onClick={() => setCategory(id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '5px 8px', marginBottom: 2, borderRadius: 7,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: active ? C.purpleLight : C.muted,
                  fontSize: 12,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {id !== 'all' && (
                    <span style={{ fontSize: 13 }}>{CATEGORY_ICONS[id as ProductCategory]}</span>
                  )}
                  {label}
                </span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 10, fontWeight: 600,
                    background: active ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
                    color: active ? C.purpleLight : C.muted,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Sort */}
          <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.08em', margin: '16px 0 8px 4px' }}>
            Sort By
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSort(e.target.value as typeof sortBy)}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontSize: 11, padding: '5px 8px', borderRadius: 7, outline: 'none',
              background: '#0f0f1a', border: `1px solid ${C.border}`,
              color: C.text, cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Installed Packs */}
          {installed.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
                letterSpacing: '0.08em', margin: '16px 0 8px 4px' }}>
                Installed ({installed.length})
              </p>
              {installed.map((pack) => (
                <div key={pack.productId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px', marginBottom: 2, borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <span style={{ fontSize: 11, color: C.text, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {pack.name}
                  </span>
                  <button
                    onClick={() => void uninstallPack(pack.productId)}
                    style={{
                      fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
                      color: C.muted, padding: '0 0 0 6px', flexShrink: 0,
                    }}
                    title="Uninstall"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Tabs */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '10px 16px 0',
          borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.bg,
        }}>
          {(['discover', 'library', 'downloads'] as const).map((tab) => {
            const active = activeTab === tab
            const label = tab.charAt(0).toUpperCase() + tab.slice(1)
            const badge = tab === 'downloads' && activeDownloads.length > 0
              ? activeDownloads.length
              : tab === 'library'
              ? installed.length
              : null

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  padding: '6px 14px', borderRadius: '8px 8px 0 0',
                  border: 'none', cursor: 'pointer',
                  background: active ? C.card : 'transparent',
                  color: active ? C.text : C.muted,
                  borderBottom: active ? `2px solid ${C.purple}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {label}
                {badge !== null && badge > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '0 5px',
                    borderRadius: 10, minWidth: 16, textAlign: 'center',
                    background: tab === 'downloads' ? C.purple : 'rgba(255,255,255,0.1)',
                    color: tab === 'downloads' ? '#fff' : C.muted,
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => void refresh()}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
              color: C.muted, marginBottom: 2,
            }}
            title="Refresh"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0,
          scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>

          {/* Error banner */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.25)`,
              color: C.red, fontSize: 12,
            }}>
              ⚠ {error} — showing offline data
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, marginBottom: 14 }}>
              <span style={{ fontSize: 12 }}>Loading marketplace…</span>
            </div>
          )}

          {/* ── DISCOVER ──────────────────────────────────────────────────── */}
          {activeTab === 'discover' && (
            <div>
              <ScrollRow
                title="✦ Featured"
                products={featured}
                downloads={downloads}
                likedIds={likedIds}
                onLike={toggleLike}
                onDownload={(p) => void downloadPack(p)}
              />
              <ScrollRow
                title="🔥 Trending"
                products={trending}
                downloads={downloads}
                likedIds={likedIds}
                onLike={toggleLike}
                onDownload={(p) => void downloadPack(p)}
              />

              {/* Product grid */}
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
                All Products
                {filteredProducts.length > 0 && (
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
                    {filteredProducts.length} results
                  </span>
                )}
              </p>

              {filteredProducts.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 13 }}>
                  No products match your filters.
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}>
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    download={downloads.find((d) => d.productId === product.id)}
                    liked={likedIds.has(product.id)}
                    onLike={() => toggleLike(product.id)}
                    onDownload={() => void downloadPack(product)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── LIBRARY ───────────────────────────────────────────────────── */}
          {activeTab === 'library' && (
            <LibraryTab
              installed={installed}
              onUninstall={(id) => void uninstallPack(id)}
              onOpenInBrowser={(pack) => {
                // Navigate to sample browser — best effort
                console.info('Open in browser:', pack.localPath)
              }}
            />
          )}

          {/* ── DOWNLOADS ─────────────────────────────────────────────────── */}
          {activeTab === 'downloads' && (
            <DownloadsTab downloads={downloads} />
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { useVstStore } from '../../store/vstStore'
import type { PluginCategory, ScannedPlugin } from '../../audio/vst/vstTypes'

// ── Plugin Browser ─────────────────────────────────────────────────────────────
// Category sidebar + search + plugin list with scan button, favorites, tags,
// collections, scan progress bar, and plugin window buttons.

const CATEGORIES: Array<{ label: string; value: PluginCategory | 'all' | 'failed' }> = [
  { label: 'All', value: 'all' },
  { label: 'Instruments', value: 'instrument' },
  { label: 'Effects', value: 'effect' },
  { label: 'MIDI Effects', value: 'midi-effect' },
  { label: 'Analyzers', value: 'analyzer' },
  { label: 'Failed', value: 'failed' },
]

const CATEGORY_COLORS: Record<string, string> = {
  instrument: '#7c5cbf',
  effect: '#2a6abf',
  'midi-effect': '#bf6a2a',
  analyzer: '#2abf6a',
  unknown: '#555',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface ContextMenu {
  x: number
  y: number
  plugin: ScannedPlugin
}

export function PluginBrowser(): React.ReactElement {
  const {
    plugins,
    scanning,
    categoryFilter,
    searchQuery,
    favorites,
    tags,
    collections,
    openWindows,
    activeScanProgress,
    scanPlugins,
    loadInstance,
    openWindow,
    setSearchQuery,
    setCategoryFilter,
    addFavorite,
    removeFavorite,
    addToCollection,
  } = useVstStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debouncedSearch = useDebounce(localSearch, 300)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  useEffect(() => {
    setSearchQuery(debouncedSearch)
  }, [debouncedSearch, setSearchQuery])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (): void => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  const handleScan = useCallback(() => {
    void scanPlugins()
  }, [scanPlugins])

  const handleDoubleClick = useCallback((plugin: ScannedPlugin) => {
    void loadInstance(plugin.id, plugin.name)
  }, [loadInstance])

  const handleOpenWindow = useCallback((plugin: ScannedPlugin, instanceId: string) => {
    void openWindow(instanceId, plugin.name)
  }, [openWindow])

  const handleToggleFavorite = useCallback((plugin: ScannedPlugin, e: React.MouseEvent) => {
    e.stopPropagation()
    if (favorites.includes(plugin.id)) {
      void removeFavorite(plugin.id)
    } else {
      void addFavorite(plugin.id)
    }
  }, [favorites, addFavorite, removeFavorite])

  const handleContextMenu = useCallback((plugin: ScannedPlugin, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, plugin })
  }, [])

  const filteredPlugins = plugins.filter(p => {
    const matchesCategory =
      categoryFilter === 'all' || categoryFilter === 'failed' || p.category === categoryFilter
    const q = searchQuery.toLowerCase()
    const pluginTags = tags[p.id] ?? []
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      pluginTags.some(t => t.toLowerCase().includes(q))
    return matchesCategory && matchesSearch
  })

  const openWindowIds = new Set(openWindows.map(w => w.instanceId))

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Category sidebar */}
      <aside style={{ width: 160, borderRight: '1px solid #333', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => {
                if (cat.value !== 'failed') {
                  setCategoryFilter(cat.value as PluginCategory | 'all')
                }
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                textAlign: 'left',
                background: categoryFilter === cat.value ? '#2a2a4a' : 'transparent',
                border: 'none',
                color: categoryFilter === cat.value ? '#a0a0ff' : '#c0c0c0',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Collections section */}
        {collections.length > 0 && (
          <div style={{ borderTop: '1px solid #333', padding: '8px 0' }}>
            <div style={{ padding: '4px 12px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Collections
            </div>
            {collections.map(coll => (
              <button
                key={coll.id}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '5px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: '#a0a0c0',
                  cursor: 'pointer',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {coll.name} ({coll.pluginIds.length})
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #333' }}>
          <input
            type="text"
            placeholder="Search by name, vendor, tag..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: '#1a1a2e',
              border: '1px solid #444',
              color: '#ddd',
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              padding: '4px 12px',
              background: '#3a3a6a',
              border: '1px solid #5a5a9a',
              color: '#c0c0ff',
              borderRadius: 4,
              cursor: scanning ? 'wait' : 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {scanning ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                {' Scanning...'}
              </>
            ) : (
              'Scan Plugins'
            )}
          </button>
        </div>

        {/* Scan progress bar */}
        {activeScanProgress && (
          <div style={{ padding: '4px 12px', borderBottom: '1px solid #222', background: '#12122a' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
              Scanning: {activeScanProgress.currentPlugin} ({activeScanProgress.scanned}/{activeScanProgress.total})
            </div>
            <div style={{ height: 3, background: '#333', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((activeScanProgress.scanned / Math.max(activeScanProgress.total, 1)) * 100)}%`,
                  background: '#5a5aff',
                  borderRadius: 2,
                  transition: 'width 0.2s',
                }}
              />
            </div>
          </div>
        )}

        {/* Plugin list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredPlugins.length === 0 ? (
            <div style={{ padding: 24, color: '#666', textAlign: 'center', fontSize: 13 }}>
              {plugins.length === 0
                ? 'No plugins found. Click Scan to discover plugins.'
                : 'No plugins match your search.'}
            </div>
          ) : (
            filteredPlugins.map(plugin => {
              const pluginTags = tags[plugin.id] ?? []
              const isFav = favorites.includes(plugin.id)
              const catColor = CATEGORY_COLORS[plugin.category] ?? '#555'

              return (
                <div
                  key={plugin.id}
                  onDoubleClick={() => handleDoubleClick(plugin)}
                  onContextMenu={(e) => handleContextMenu(plugin, e)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #222',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  {/* Favorite star */}
                  <button
                    onClick={(e) => handleToggleFavorite(plugin, e)}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isFav ? '#ffd700' : '#555',
                      fontSize: 14,
                      padding: '2px 0',
                      flexShrink: 0,
                    }}
                  >
                    {isFav ? '★' : '☆'}
                  </button>

                  {/* Plugin info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13, color: '#e0e0e0' }}>
                      {plugin.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {plugin.vendor} · v{plugin.version}
                    </div>
                    {/* Tag chips */}
                    {pluginTags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {pluginTags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 8,
                              background: '#1a2a3a',
                              color: '#60a0d0',
                              border: '1px solid #2a4a6a',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category badge */}
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 10,
                      background: catColor + '33',
                      color: catColor,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      flexShrink: 0,
                      border: `1px solid ${catColor}55`,
                    }}
                  >
                    {plugin.category}
                  </span>

                  {/* Open window button (only for loaded instances) */}
                  {Array.from(openWindowIds).some(id => id.startsWith(plugin.id)) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const instanceId = Array.from(openWindowIds).find(id => id.startsWith(plugin.id))
                        if (instanceId) handleOpenWindow(plugin, instanceId)
                      }}
                      title="Open Plugin Window"
                      style={{
                        padding: '2px 6px',
                        background: '#2a3a5a',
                        border: '1px solid #3a5a8a',
                        color: '#80b0e0',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      UI
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1e1e3e',
            border: '1px solid #444',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 9999,
            minWidth: 180,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label={favorites.includes(contextMenu.plugin.id) ? '★ Remove from Favorites' : '☆ Add to Favorites'}
            onClick={() => {
              if (favorites.includes(contextMenu.plugin.id)) {
                void removeFavorite(contextMenu.plugin.id)
              } else {
                void addFavorite(contextMenu.plugin.id)
              }
              setContextMenu(null)
            }}
          />
          {collections.length > 0 && (
            <>
              <div style={{ height: 1, background: '#333', margin: '4px 0' }} />
              <div style={{ padding: '2px 12px', fontSize: 11, color: '#666' }}>Add to collection</div>
              {collections.map(coll => (
                <ContextMenuItem
                  key={coll.id}
                  label={`  ${coll.name}`}
                  onClick={() => {
                    void addToCollection(coll.id, contextMenu.plugin.id)
                    setContextMenu(null)
                  }}
                />
              ))}
            </>
          )}
          <div style={{ height: 1, background: '#333', margin: '4px 0' }} />
          <ContextMenuItem
            label="Load Instance"
            onClick={() => {
              void loadInstance(contextMenu.plugin.id, contextMenu.plugin.name)
              setContextMenu(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }): React.ReactElement {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 12px',
        textAlign: 'left',
        background: hovered ? '#2a2a5a' : 'transparent',
        border: 'none',
        color: '#d0d0e0',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { useVstStore } from '../../store/vstStore'
import type { PluginCategory, ScannedPlugin } from '../../audio/vst/vstTypes'

// ── Plugin Browser ─────────────────────────────────────────────────────────────
// Category sidebar + search + plugin list with scan button.

const CATEGORIES: Array<{ label: string; value: PluginCategory | 'all' | 'failed' }> = [
  { label: 'All', value: 'all' },
  { label: 'Instruments', value: 'instrument' },
  { label: 'Effects', value: 'effect' },
  { label: 'MIDI Effects', value: 'midi-effect' },
  { label: 'Analyzers', value: 'analyzer' },
  { label: 'Failed', value: 'failed' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function PluginBrowser(): React.ReactElement {
  const {
    plugins,
    scanning,
    categoryFilter,
    searchQuery,
    scanPlugins,
    loadInstance,
    setSearchQuery,
    setCategoryFilter,
  } = useVstStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debouncedSearch = useDebounce(localSearch, 300)

  useEffect(() => {
    setSearchQuery(debouncedSearch)
  }, [debouncedSearch, setSearchQuery])

  const handleScan = useCallback(() => {
    void scanPlugins()
  }, [scanPlugins])

  const handleDoubleClick = useCallback((plugin: ScannedPlugin) => {
    void loadInstance(plugin.id, plugin.name)
  }, [loadInstance])

  const filteredPlugins = plugins.filter(p => {
    const matchesCategory =
      categoryFilter === 'all' || categoryFilter === 'failed' ? true : p.category === categoryFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Category sidebar */}
      <aside style={{ width: 160, borderRight: '1px solid #333', padding: '8px 0' }}>
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
      </aside>

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #333' }}>
          <input
            type="text"
            placeholder="Search plugins..."
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

        {/* Plugin list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredPlugins.length === 0 ? (
            <div style={{ padding: 24, color: '#666', textAlign: 'center', fontSize: 13 }}>
              {plugins.length === 0 ? 'No plugins found. Click Scan to discover plugins.' : 'No plugins match your search.'}
            </div>
          ) : (
            filteredPlugins.map(plugin => (
              <div
                key={plugin.id}
                onDoubleClick={() => handleDoubleClick(plugin)}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #222',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 13, color: '#e0e0e0' }}>
                    {plugin.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {plugin.vendor}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 10,
                    background: '#2a2a4a',
                    color: '#9090cc',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {plugin.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useCallback } from 'react'
import { useVstStore } from '../../store/vstStore'
import type { ScannedPlugin } from '../../audio/vst/vstTypes'

// ── Plugin Manager Panel ───────────────────────────────────────────────────────
// Full plugin management UI with tabs: All Plugins | Favorites | Collections | Failed

type Tab = 'all' | 'favorites' | 'collections' | 'failed'

interface DetailsPlugin {
  plugin: ScannedPlugin
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  instrument: { bg: '#3a1a6a', text: '#c090ff' },
  effect:     { bg: '#1a2a5a', text: '#6090ff' },
  'midi-effect': { bg: '#5a2a1a', text: '#ffa060' },
  analyzer:   { bg: '#1a5a2a', text: '#60ffa0' },
  unknown:    { bg: '#2a2a2a', text: '#888' },
}

export function PluginManagerPanel(): React.ReactElement {
  const {
    plugins,
    favorites,
    tags,
    collections,
    scanning,
    scanPlugins,
    loadInstance,
    addFavorite,
    removeFavorite,
    loadCollections,
  } = useVstStore()

  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [selectedPlugin, setSelectedPlugin] = useState<DetailsPlugin | null>(null)
  const [confirmBlacklist, setConfirmBlacklist] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab)
    setSelectedPlugin(null)
    if (tab === 'collections') {
      void loadCollections()
    }
  }, [loadCollections])

  const handleScan = useCallback(() => {
    void scanPlugins()
  }, [scanPlugins])

  const handleLoad = useCallback((plugin: ScannedPlugin) => {
    void loadInstance(plugin.id, plugin.name)
  }, [loadInstance])

  const handleToggleFavorite = useCallback((plugin: ScannedPlugin) => {
    if (favorites.includes(plugin.id)) {
      void removeFavorite(plugin.id)
    } else {
      void addFavorite(plugin.id)
    }
  }, [favorites, addFavorite, removeFavorite])

  // ── Compute visible plugins ─────────────────────────────────────────────

  const getTabPlugins = (): ScannedPlugin[] => {
    let base: ScannedPlugin[] = []

    if (activeTab === 'all') {
      base = plugins
    } else if (activeTab === 'favorites') {
      base = plugins.filter(p => favorites.includes(p.id))
    } else if (activeTab === 'collections') {
      base = plugins // all (user picks collection in sidebar)
    } else {
      base = [] // failed — would come from database failed map
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      base = base.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        (tags[p.id] ?? []).some(t => t.toLowerCase().includes(q))
      )
    }

    return base
  }

  const visiblePlugins = getTabPlugins()

  return (
    <div style={{ display: 'flex', height: '100%', background: '#111122', color: '#ddd', fontSize: 13 }}>
      {/* Left: Plugin list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
          {(['all', 'favorites', 'collections', 'failed'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: activeTab === tab ? '#1e1e3e' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #5a5aff' : '2px solid transparent',
                color: activeTab === tab ? '#a0a0ff' : '#888',
                cursor: 'pointer',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {tab === 'all' ? `All (${plugins.length})` :
               tab === 'favorites' ? `Favorites (${favorites.length})` :
               tab === 'collections' ? `Collections (${collections.length})` :
               'Failed'}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid #222' }}>
          <input
            type="text"
            placeholder="Filter plugins..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '3px 7px',
              background: '#0e0e1e',
              border: '1px solid #333',
              color: '#ddd',
              borderRadius: 3,
              fontSize: 12,
            }}
          />
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              padding: '3px 10px',
              background: '#2a2a5a',
              border: '1px solid #4a4a8a',
              color: '#9090cc',
              borderRadius: 3,
              cursor: scanning ? 'wait' : 'pointer',
              fontSize: 12,
            }}
          >
            {scanning ? 'Scanning...' : 'Re-scan All'}
          </button>
        </div>

        {/* Collections filter (for collections tab) */}
        {activeTab === 'collections' && collections.length > 0 && (
          <div style={{ padding: '4px 10px', borderBottom: '1px solid #222', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {collections.map(coll => (
              <span
                key={coll.id}
                style={{
                  padding: '2px 8px',
                  background: '#1a1a3a',
                  border: '1px solid #3a3a6a',
                  borderRadius: 12,
                  fontSize: 11,
                  color: '#8080cc',
                  cursor: 'pointer',
                }}
              >
                {coll.name} ({coll.pluginIds.length})
              </span>
            ))}
          </div>
        )}

        {/* Plugin rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visiblePlugins.length === 0 ? (
            <div style={{ padding: 24, color: '#555', textAlign: 'center' }}>
              {activeTab === 'favorites'
                ? 'No favorites yet. Star a plugin to add it here.'
                : activeTab === 'failed'
                ? 'No failed plugins.'
                : plugins.length === 0
                ? 'No plugins scanned yet.'
                : 'No plugins match the filter.'}
            </div>
          ) : (
            visiblePlugins.map(plugin => (
              <PluginRow
                key={plugin.id}
                plugin={plugin}
                isFavorite={favorites.includes(plugin.id)}
                tags={tags[plugin.id] ?? []}
                isSelected={selectedPlugin?.plugin.id === plugin.id}
                onSelect={() => setSelectedPlugin({ plugin })}
                onLoad={() => handleLoad(plugin)}
                onToggleFavorite={() => handleToggleFavorite(plugin)}
                onBlacklist={() => setConfirmBlacklist(plugin.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Details panel */}
      {selectedPlugin && (
        <PluginDetailsPanel
          plugin={selectedPlugin.plugin}
          tags={tags[selectedPlugin.plugin.id] ?? []}
          onClose={() => setSelectedPlugin(null)}
          onLoad={() => handleLoad(selectedPlugin.plugin)}
        />
      )}

      {/* Blacklist confirmation dialog */}
      {confirmBlacklist && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{
            background: '#1a1a2e',
            border: '1px solid #444',
            borderRadius: 8,
            padding: 24,
            maxWidth: 360,
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: 12, color: '#ff8080', fontWeight: 'bold' }}>
              Blacklist Plugin?
            </div>
            <div style={{ marginBottom: 20, color: '#aaa', fontSize: 12 }}>
              This plugin will be marked as failed and won&apos;t be loaded automatically.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmBlacklist(null)}
                style={{ padding: '6px 16px', background: '#2a2a4a', border: '1px solid #444', color: '#aaa', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // In production: call vstClient.blacklistPlugin(confirmBlacklist)
                  setConfirmBlacklist(null)
                }}
                style={{ padding: '6px 16px', background: '#6a1a1a', border: '1px solid #aa3a3a', color: '#ffaaaa', borderRadius: 4, cursor: 'pointer' }}
              >
                Blacklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Plugin Row ─────────────────────────────────────────────────────────────────

interface PluginRowProps {
  plugin: ScannedPlugin
  isFavorite: boolean
  tags: string[]
  isSelected: boolean
  onSelect: () => void
  onLoad: () => void
  onToggleFavorite: () => void
  onBlacklist: () => void
}

function PluginRow({
  plugin, isFavorite, tags, isSelected, onSelect, onLoad, onToggleFavorite, onBlacklist,
}: PluginRowProps): React.ReactElement {
  const badge = BADGE_COLORS[plugin.category] ?? BADGE_COLORS['unknown']

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '7px 10px',
        borderBottom: '1px solid #1e1e2e',
        background: isSelected ? '#1a1a3a' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavorite ? '#ffd700' : '#444', fontSize: 14, padding: 0 }}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      {/* Name + vendor + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e0e0e0', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plugin.name}
        </div>
        <div style={{ color: '#666', fontSize: 11 }}>
          {plugin.vendor}
          {plugin.version && <span style={{ marginLeft: 6, color: '#555' }}>v{plugin.version}</span>}
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: '#1a2a3a', color: '#5090c0', border: '1px solid #2a4a6a' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category badge */}
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: badge.bg, color: badge.text, flexShrink: 0 }}>
        {plugin.category}
      </span>

      {/* Load button */}
      <button
        onClick={(e) => { e.stopPropagation(); onLoad() }}
        style={{ padding: '3px 8px', background: '#2a4a2a', border: '1px solid #4a7a4a', color: '#80c080', borderRadius: 3, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
      >
        Load
      </button>

      {/* Details (handled by row click) */}
      <button
        onClick={(e) => { e.stopPropagation(); onBlacklist() }}
        style={{ padding: '3px 8px', background: '#4a1a1a', border: '1px solid #7a3a3a', color: '#ff8080', borderRadius: 3, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
        title="Blacklist this plugin"
      >
        Block
      </button>
    </div>
  )
}

// ── Plugin Details Panel ───────────────────────────────────────────────────────

interface PluginDetailsPanelProps {
  plugin: ScannedPlugin
  tags: string[]
  onClose: () => void
  onLoad: () => void
}

function PluginDetailsPanel({ plugin, tags, onClose, onLoad }: PluginDetailsPanelProps): React.ReactElement {
  return (
    <div style={{ width: 280, borderLeft: '1px solid #333', padding: 16, overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', color: '#c0c0ff', fontSize: 14 }}>{plugin.name}</div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <DetailRow label="Vendor" value={plugin.vendor} />
      <DetailRow label="Version" value={plugin.version} />
      <DetailRow label="Category" value={plugin.category} />
      {plugin.cid && <DetailRow label="CID" value={plugin.cid} mono />}
      {plugin.sdkVersion && <DetailRow label="SDK Version" value={plugin.sdkVersion} />}
      <DetailRow label="Parameters" value={String(plugin.paramCount)} />
      <DetailRow label="Input Buses" value={String(plugin.inputBusCount)} />
      <DetailRow label="Output Buses" value={String(plugin.outputBusCount)} />
      <DetailRow label="Has Editor" value={plugin.hasEditor ? 'Yes' : 'No'} />
      <DetailRow label="MIDI Support" value={plugin.supportsMidi ? 'Yes' : 'No'} />

      {plugin.subCategories && plugin.subCategories.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Subcategories</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {plugin.subCategories.map(sc => (
              <span key={sc} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#2a2a4a', color: '#9090cc' }}>
                {sc}
              </span>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#1a2a3a', color: '#5090c0', border: '1px solid #2a4a6a' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 4, marginBottom: 10 }}>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Path</div>
        <div style={{ color: '#888', fontSize: 11, wordBreak: 'break-all', fontFamily: 'monospace' }}>
          {plugin.path}
        </div>
      </div>

      {plugin.binaryExists !== undefined && (
        <DetailRow label="Binary" value={plugin.binaryExists ? '✓ Found' : '✗ Missing'} />
      )}

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onLoad}
          style={{
            width: '100%',
            padding: '8px',
            background: '#1a3a1a',
            border: '1px solid #3a6a3a',
            color: '#70d070',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Load Instance
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): React.ReactElement {
  return (
    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#666', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#aaa', fontSize: 12, fontFamily: mono ? 'monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

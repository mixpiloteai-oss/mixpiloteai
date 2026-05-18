import { useState } from 'react'
import type { VSTPlugin } from '../../types/audio'

const MOCK_PLUGINS: VSTPlugin[] = [
  { id:'1', name:'Serum',        vendor:'Xfer Records',  path:'C:\\VSTPlugins\\Serum.dll',         format:'VST3', category:'instrument', hasEditor:true,  paramCount:512, isFavorite:true  },
  { id:'2', name:'Massive X',    vendor:'Native Instr.', path:'C:\\VST3\\MassiveX.vst3',           format:'VST3', category:'instrument', hasEditor:true,  paramCount:320, isFavorite:true  },
  { id:'3', name:'Pro-Q 3',      vendor:'FabFilter',     path:'C:\\VST3\\ProQ3.vst3',              format:'VST3', category:'effect',     hasEditor:true,  paramCount:48,  isFavorite:true  },
  { id:'4', name:'Pro-R',        vendor:'FabFilter',     path:'C:\\VST3\\ProR.vst3',               format:'VST3', category:'effect',     hasEditor:true,  paramCount:32,  isFavorite:false },
  { id:'5', name:'Saturn 2',     vendor:'FabFilter',     path:'C:\\VST3\\Saturn2.vst3',            format:'VST3', category:'effect',     hasEditor:true,  paramCount:64,  isFavorite:false },
  { id:'6', name:'Kontakt 7',    vendor:'Native Instr.', path:'C:\\VSTPlugins\\Kontakt7.dll',      format:'VST2', category:'instrument', hasEditor:true,  paramCount:128, isFavorite:false },
  { id:'7', name:'Izotope Ozone',vendor:'Izotope',       path:'C:\\VST3\\OzoneStereo.vst3',        format:'VST3', category:'effect',     hasEditor:true,  paramCount:256, isFavorite:false },
  { id:'8', name:'Valhalla Room', vendor:'Valhalla DSP', path:'C:\\VST3\\ValhallaRoom.vst3',       format:'VST3', category:'effect',     hasEditor:true,  paramCount:18,  isFavorite:true  },
  { id:'9', name:'Bitwig Grid',  vendor:'Bitwig',        path:'C:\\VST3\\BitwigGrid.vst3',         format:'VST3', category:'instrument', hasEditor:true,  paramCount:999, isFavorite:false },
  { id:'10',name:'Vital',        vendor:'Matt Tytel',    path:'C:\\VSTPlugins\\Vital.dll',         format:'VST2', category:'instrument', hasEditor:true,  paramCount:680, isFavorite:true  },
]

type FilterType = 'all' | 'instrument' | 'effect' | 'analyzer' | 'favorites'

export default function PluginBrowser() {
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<FilterType>('all')
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<VSTPlugin | null>(null)

  const filtered = MOCK_PLUGINS.filter(p => {
    if (filter === 'favorites' && !p.isFavorite) return false
    if (filter !== 'all' && filter !== 'favorites' && p.category !== filter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.vendor.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function scan() {
    setScanning(true)
    setTimeout(() => setScanning(false), 2000)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Left — browser */}
      <div className="flex flex-col w-72 shrink-0" style={{ borderRight: '1px solid #1c1c2e' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
          <span className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: '#334155' }}>Plugins</span>
          <button
            onClick={scan}
            disabled={scanning}
            className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#7c3aed' }}
          >
            {scanning ? 'Scanning…' : '⟳ Rescan'}
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plugins…"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          {(['all','instrument','effect','favorites'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-1 py-1 rounded text-[9px] capitalize transition-all"
              style={{
                background: filter === f ? 'rgba(124,58,237,0.2)' : 'transparent',
                color:      filter === f ? '#a855f7' : '#475569',
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: '#334155' }}>No plugins found</p>
          )}
          {filtered.map(plugin => (
            <button
              key={plugin.id}
              onClick={() => setSelected(plugin)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
              style={{
                background:   selected?.id === plugin.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                borderLeft:   `2px solid ${selected?.id === plugin.id ? '#7c3aed' : 'transparent'}`,
                borderBottom: '1px solid #13131f',
              }}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] shrink-0"
                style={{
                  background: plugin.category === 'instrument' ? 'rgba(124,58,237,0.15)' : 'rgba(6,182,212,0.15)',
                  color:      plugin.category === 'instrument' ? '#7c3aed' : '#06b6d4',
                }}
              >
                {plugin.category === 'instrument' ? '♪' : '≋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: '#94a3b8' }}>{plugin.name}</p>
                <p className="text-[10px] truncate" style={{ color: '#475569' }}>{plugin.vendor}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8px] px-1 py-px rounded" style={{ background: '#1c1c2e', color: '#334155' }}>{plugin.format}</span>
                {plugin.isFavorite && <span style={{ color: '#f59e0b', fontSize: 9 }}>★</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="px-3 py-1.5 text-[10px] shrink-0" style={{ borderTop: '1px solid #1c1c2e', color: '#334155' }}>
          {filtered.length} / {MOCK_PLUGINS.length} plugins
        </div>
      </div>

      {/* Right — detail / drag target */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        {selected ? (
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                {selected.category === 'instrument' ? '♪' : '≋'}
              </div>
              <div>
                <h3 className="font-bold text-studio-text">{selected.name}</h3>
                <p className="text-xs" style={{ color: '#475569' }}>{selected.vendor} · {selected.format}</p>
              </div>
            </div>

            {[
              ['Category',   selected.category],
              ['Format',     selected.format],
              ['Parameters', String(selected.paramCount)],
              ['Has Editor', selected.hasEditor ? 'Yes' : 'No'],
              ['Path',       selected.path],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #13131f' }}>
                <span className="text-xs" style={{ color: '#475569' }}>{k}</span>
                <span className="text-xs font-mono truncate max-w-[180px] text-right" style={{ color: '#94a3b8' }}>{v}</span>
              </div>
            ))}

            <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a855f7' }}>
              Load Plugin
            </button>
          </div>
        ) : (
          <>
            <div className="text-4xl opacity-20">⊕</div>
            <p className="text-sm" style={{ color: '#334155' }}>Select a plugin to view details</p>
            <p className="text-xs" style={{ color: '#1c1c2e' }}>Drag to a track to load</p>
          </>
        )}
      </div>
    </div>
  )
}

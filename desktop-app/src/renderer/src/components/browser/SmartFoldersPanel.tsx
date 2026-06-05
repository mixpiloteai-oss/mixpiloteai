import { useState } from 'react'
import { useSampleBrowserStore } from '../../store/sampleBrowserStore'
import type { SmartFolder } from '../../audio/browser/types'

export default function SmartFoldersPanel() {
  const smartFolders   = useSampleBrowserStore(s => s.smartFolders)
  const createSF       = useSampleBrowserStore(s => s.createSmartFolder)
  const deleteSF       = useSampleBrowserStore(s => s.deleteSmartFolder)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [query, setQLocal] = useState('')

  const runSmartFolder = (sf: SmartFolder) => {
    useSampleBrowserStore.setState({
      query:         sf.query,
      typeFilter:    sf.type,
      favoritesOnly: sf.favorite ?? false,
      tagFilters:    sf.tags,
    })
    void useSampleBrowserStore.getState().searchSamples()
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Smart Folders</span>
        <button onClick={() => setCreating(true)} className="text-xs text-white/40 hover:text-white/80 px-1" title="Save current search">+</button>
      </div>

      {creating && (
        <form onSubmit={async e => {
          e.preventDefault()
          if (name.trim()) {
            await createSF(name.trim(), query, { type: null, favorite: null, tags: [] })
            setName(''); setQLocal(''); setCreating(false)
          }
        }} className="flex flex-col gap-1 px-1">
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            className="bg-white/10 text-white text-xs px-2 py-1 rounded outline-none border border-white/20 focus:border-accent"
            placeholder="Folder name..." />
          <input value={query} onChange={e => setQLocal(e.target.value)}
            className="bg-white/10 text-white text-xs px-2 py-1 rounded outline-none border border-white/20 focus:border-accent"
            placeholder="Search query..." />
          <div className="flex gap-1">
            <button type="submit" className="text-xs bg-accent/80 text-white px-2 py-0.5 rounded">Save</button>
            <button type="button" onClick={() => setCreating(false)} className="text-xs text-white/40 px-2 py-0.5">Cancel</button>
          </div>
        </form>
      )}

      {smartFolders.length === 0 && !creating && (
        <p className="text-xs text-white/30 px-2 py-1 italic">No saved searches</p>
      )}

      {smartFolders.map(sf => (
        <div
          key={sf.id}
          onClick={() => runSmartFolder(sf)}
          className="flex items-center justify-between px-2 py-1 rounded cursor-pointer group text-white/70 hover:bg-white/5"
        >
          <span className="text-xs truncate flex-1">🔍 {sf.name}</span>
          <button
            onClick={e => { e.stopPropagation(); void deleteSF(sf.id) }}
            className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs"
          >×</button>
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import { useSampleBrowserStore } from '../../store/sampleBrowserStore'

export default function CollectionsPanel() {
  const collections       = useSampleBrowserStore(s => s.collections)
  const activeId          = useSampleBrowserStore(s => s.activeCollectionId)
  const createCollection  = useSampleBrowserStore(s => s.createCollection)
  const deleteCollection  = useSampleBrowserStore(s => s.deleteCollection)
  const setActive         = useSampleBrowserStore(s => s.setActiveCollection)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Collections</span>
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-white/40 hover:text-white/80 px-1"
          title="New collection"
        >+</button>
      </div>

      {creating && (
        <form onSubmit={async e => {
          e.preventDefault()
          if (newName.trim()) {
            await createCollection(newName.trim())
            setNewName('')
            setCreating(false)
          }
        }} className="flex gap-1 px-1">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={() => { setCreating(false); setNewName('') }}
            className="flex-1 bg-white/10 text-white text-xs px-2 py-1 rounded outline-none border border-white/20 focus:border-accent"
            placeholder="Collection name..."
          />
        </form>
      )}

      {collections.length === 0 && !creating && (
        <p className="text-xs text-white/30 px-2 py-1 italic">No collections yet</p>
      )}

      {collections.map(col => (
        <div
          key={col.id}
          onClick={() => setActive(activeId === col.id ? null : col.id)}
          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer group ${activeId === col.id ? 'bg-accent/20 text-accent' : 'text-white/70 hover:bg-white/5'}`}
        >
          <span className="text-xs truncate flex-1">📁 {col.name}</span>
          <span className="text-xs text-white/30 mr-1">{col.sampleIds.length}</span>
          <button
            onClick={e => { e.stopPropagation(); void deleteCollection(col.id) }}
            className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs"
          >×</button>
        </div>
      ))}
    </div>
  )
}

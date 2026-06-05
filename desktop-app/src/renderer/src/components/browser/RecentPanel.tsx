import { useSampleBrowserStore } from '../../store/sampleBrowserStore'

export default function RecentPanel() {
  const recentSamples  = useSampleBrowserStore(s => s.recentSamples)
  const clearRecent    = useSampleBrowserStore(s => s.clearRecent)
  const setSelected    = useSampleBrowserStore(s => s.setSelected)
  const top10          = recentSamples.slice(0, 10)

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Recent</span>
        {recentSamples.length > 0 && (
          <button onClick={clearRecent} className="text-xs text-white/30 hover:text-white/60 px-1">clear</button>
        )}
      </div>
      {top10.length === 0 && (
        <p className="text-xs text-white/30 px-2 py-1 italic">No recent samples</p>
      )}
      {top10.map(r => (
        <div
          key={r.sampleId}
          onClick={() => setSelected(r.sampleId)}
          className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-white/60 hover:bg-white/5 hover:text-white/90 group"
        >
          <span className="text-xs truncate flex-1">🎵 {r.name}</span>
          <span className="text-xs text-white/25 shrink-0">{new Date(r.accessedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
      ))}
    </div>
  )
}

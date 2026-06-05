import { useProjectStore } from '../../store/projectStore'

export default function TitleBar() {
  const name = useProjectStore(s => s.project.name)

  return (
    <div
      className="h-9 flex items-center justify-between px-3 shrink-0 select-none"
      style={{ background: '#06060d', borderBottom: '1px solid #1c1c2e' }}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error webkit-app-region is non-standard
      style2={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left — app identity */}
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded bg-gradient-to-br from-studio-purple to-studio-cyan flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          N
        </span>
        <span className="text-[11px] font-semibold text-studio-text/80 tracking-wide">
          NEUROTEK STUDIO
        </span>
        <span className="text-[11px] text-studio-muted mx-1">·</span>
        <span className="text-[11px] text-studio-muted">{name}</span>
      </div>

      {/* Window controls (Windows style) */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {[
          { label: '─', action: () => window.electronAPI?.minimize(), hover: 'hover:bg-white/10' },
          { label: '□', action: () => window.electronAPI?.maximize(), hover: 'hover:bg-white/10' },
          { label: '✕', action: () => window.electronAPI?.close(),    hover: 'hover:bg-red-600' },
        ].map(({ label, action, hover }) => (
          <button
            key={label}
            onClick={action}
            className={`w-11 h-9 flex items-center justify-center text-studio-muted text-xs transition-colors ${hover} hover:text-white`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

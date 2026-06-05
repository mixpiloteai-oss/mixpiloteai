import type { SamplerZone, SamplerConfig } from '../../audio/instruments/SamplerEngine'
import { pitchName } from '../piano-roll/types'

interface Props {
  zones:  SamplerZone[]
  config: SamplerConfig
  onAddZone:    (zone: Omit<SamplerZone, 'id'>) => void
  onRemoveZone: (id: string) => void
  onConfigChange: (patch: Partial<SamplerConfig>) => void
}

export default function SamplerPanel({ zones, config, onAddZone, onRemoveZone, onConfigChange }: Props) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-surface text-white" style={{ minWidth: 380 }}>
      {/* ADSR */}
      <div className="bg-white/5 rounded-lg p-3">
        <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-widest mb-2">Envelope</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['attack','decay','sustain','release'] as const).map(k => (
            <label key={k} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/50 capitalize">{k}</span>
              <input type="range" min={k === 'sustain' ? 0 : 0.001} max={k === 'sustain' ? 1 : 10}
                step={0.001} value={config[k]}
                onChange={e => onConfigChange({ [k]: Number(e.target.value) })}
                className="accent-accent h-1" />
              <span className="text-[10px] text-white/60 tabular-nums">{config[k].toFixed(3)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Zones */}
      <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Zones ({zones.length})</h3>
          <button
            onClick={() => onAddZone({
              name: 'New Zone', buffer: null, rootPitch: 60,
              pitchLo: 0, pitchHi: 127, velLo: 0, velHi: 127,
              loopEnabled: false, loopStart: 0, loopEnd: 0, tune: 0, gain: 1,
            })}
            className="text-xs bg-accent/80 hover:bg-accent text-white px-2 py-0.5 rounded"
          >+ Zone</button>
        </div>

        {zones.length === 0 && (
          <p className="text-xs text-white/30 italic">No zones. Add a zone and load a sample.</p>
        )}

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {zones.map(z => (
            <div key={z.id} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1 text-xs">
              <span className="w-16 truncate text-white/70">{z.name}</span>
              <span className="text-white/40">{pitchName(z.pitchLo)}–{pitchName(z.pitchHi)}</span>
              <span className="text-white/40">root:{pitchName(z.rootPitch)}</span>
              <span className={`ml-auto text-[10px] ${z.buffer ? 'text-green-400' : 'text-white/30'}`}>
                {z.buffer ? `${z.buffer.duration.toFixed(1)}s` : 'no sample'}
              </span>
              <button onClick={() => onRemoveZone(z.id)} className="text-white/30 hover:text-red-400">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

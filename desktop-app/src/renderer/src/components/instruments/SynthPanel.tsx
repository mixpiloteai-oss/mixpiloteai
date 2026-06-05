import { useState } from 'react'
import type { SynthParams } from '../../audio/instruments/SubtractiveSynth'
import { DEFAULT_SYNTH_PARAMS } from '../../audio/instruments/SubtractiveSynth'
import { getSynthPresetManager } from '../../audio/instruments/InstrumentPresetManager'

interface Props {
  params: SynthParams
  onParamChange: (patch: Partial<SynthParams>) => void
}

// Small labeled slider component (internal, not exported)
function Knob({ label, value, min, max, step = 0.001, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; unit?: string
}) {
  return (
    <label className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[10px] text-white/50 uppercase tracking-wide leading-none">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1" />
      <span className="text-[10px] text-white/60 tabular-nums">{value.toFixed(2)}{unit}</span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

export default function SynthPanel({ params, onParamChange }: Props) {
  const presetMgr = getSynthPresetManager()
  const presets   = presetMgr.list()
  const [newPresetName, setNewPresetName] = useState('')

  const p  = (field: keyof SynthParams) => (v: number) => onParamChange({ [field]: v })
  const ps = (field: keyof SynthParams) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onParamChange({ [field]: e.target.value as OscillatorType })

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface text-white overflow-y-auto" style={{ minWidth: 420 }}>
      {/* Preset bar */}
      <div className="flex items-center gap-2">
        <select
          onChange={e => {
            const preset = presetMgr.load(e.target.value)
            if (preset) onParamChange(preset.params)
          }}
          className="flex-1 bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10"
        >
          <option value="">— Select preset —</option>
          {presets.map(pr => (
            <option key={pr.id} value={pr.id}>{pr.isFactory ? '⭐ ' : ''}{pr.name}</option>
          ))}
        </select>
        <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)}
          placeholder="Preset name..." className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10 w-28 outline-none" />
        <button
          onClick={() => { if (newPresetName.trim()) { presetMgr.save(newPresetName.trim(), params); setNewPresetName('') } }}
          className="text-xs bg-accent/80 hover:bg-accent text-white px-2 py-1 rounded"
        >Save</button>
        <button onClick={() => onParamChange({ ...DEFAULT_SYNTH_PARAMS })}
          className="text-xs text-white/40 hover:text-white/80 px-2 py-1 rounded border border-white/10"
        >Init</button>
      </div>

      {/* OSC section */}
      <Section title="Oscillators">
        <div className="grid grid-cols-4 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/50">Osc1 Wave</span>
            <select value={params.osc1Wave} onChange={ps('osc1Wave')} className="bg-white/10 text-white text-xs px-1 py-0.5 rounded">
              {(['sine','square','sawtooth','triangle'] as OscillatorType[]).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <Knob label="Osc1 Vol" value={params.osc1Level} min={0} max={1} onChange={p('osc1Level')} />
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/50">Osc2 Wave</span>
            <select value={params.osc2Wave} onChange={ps('osc2Wave')} className="bg-white/10 text-white text-xs px-1 py-0.5 rounded">
              {(['sine','square','sawtooth','triangle'] as OscillatorType[]).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <Knob label="Osc2 Vol" value={params.osc2Level} min={0} max={1} onChange={p('osc2Level')} />
          <Knob label="Osc2 Det" value={params.osc2Detune} min={-100} max={100} step={1} onChange={p('osc2Detune')} unit="c" />
          <Knob label="Osc2 Oct" value={params.osc2Semitones} min={-24} max={24} step={1} onChange={p('osc2Semitones')} unit="st" />
        </div>
      </Section>

      {/* Amp ADSR */}
      <Section title="Amp Envelope">
        <div className="grid grid-cols-4 gap-2">
          <Knob label="Attack"  value={params.attack}  min={0.001} max={5} onChange={p('attack')}  unit="s" />
          <Knob label="Decay"   value={params.decay}   min={0.001} max={5} onChange={p('decay')}   unit="s" />
          <Knob label="Sustain" value={params.sustain} min={0}     max={1} onChange={p('sustain')} />
          <Knob label="Release" value={params.release} min={0.001} max={8} onChange={p('release')} unit="s" />
        </div>
      </Section>

      {/* Filter */}
      <Section title="Filter">
        <div className="grid grid-cols-4 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/50">Type</span>
            <select value={params.filterType} onChange={e => onParamChange({ filterType: e.target.value as 'lowpass'|'highpass'|'bandpass' })}
              className="bg-white/10 text-white text-xs px-1 py-0.5 rounded">
              {['lowpass','highpass','bandpass'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <Knob label="Cutoff" value={params.filterCutoff} min={20} max={20000} step={1} onChange={p('filterCutoff')} unit="Hz" />
          <Knob label="Res"    value={params.filterResonance} min={0.1} max={20} onChange={p('filterResonance')} />
          <Knob label="Env Amt" value={params.filterEnvAmount} min={-4} max={4} onChange={p('filterEnvAmount')} unit="oct" />
          <Knob label="F.Atk"  value={params.filterAttack}  min={0.001} max={5} onChange={p('filterAttack')}  unit="s" />
          <Knob label="F.Dec"  value={params.filterDecay}   min={0.001} max={5} onChange={p('filterDecay')}   unit="s" />
          <Knob label="F.Sus"  value={params.filterSustain} min={0}     max={1} onChange={p('filterSustain')} />
          <Knob label="F.Rel"  value={params.filterRelease} min={0.001} max={8} onChange={p('filterRelease')} unit="s" />
        </div>
      </Section>

      {/* LFO */}
      <Section title="LFO">
        <div className="grid grid-cols-4 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/50">Target</span>
            <select value={params.lfoTarget} onChange={e => onParamChange({ lfoTarget: e.target.value as 'pitch'|'filter'|'amp' })}
              className="bg-white/10 text-white text-xs px-1 py-0.5 rounded">
              {['pitch','filter','amp'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <Knob label="Rate"   value={params.lfoRate}   min={0.1} max={20} onChange={p('lfoRate')}   unit="Hz" />
          <Knob label="Amount" value={params.lfoAmount} min={0}   max={1}  onChange={p('lfoAmount')} />
        </div>
      </Section>

      {/* Master */}
      <Section title="Master">
        <div className="grid grid-cols-3 gap-2">
          <Knob label="Volume" value={params.volume} min={0} max={1} onChange={p('volume')} />
          <Knob label="Voices" value={params.polyphony} min={1} max={16} step={1} onChange={v => onParamChange({ polyphony: Math.round(v) })} />
        </div>
      </Section>
    </div>
  )
}

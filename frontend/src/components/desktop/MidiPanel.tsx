// ============================================================
// MidiPanel — MIDI device scanner panel (desktop only)
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Music2, Usb, Activity, RefreshCw } from 'lucide-react';
import { useElectron, type MidiDevices } from '../../hooks/useElectron';

const KNOWN_CONTROLLERS: Record<string, string> = {
  APC: 'Akai APC', MPC: 'Akai MPC', MPK: 'Akai MPK',
  Launchpad: 'Novation Launchpad', Maschine: 'NI Maschine',
  Komplete: 'NI Komplete', Arturia: 'Arturia',
  Push: 'Ableton Push', Keystep: 'Arturia KeyStep', Beatstep: 'Arturia BeatStep',
};

function detectController(name: string): string {
  for (const [key, label] of Object.entries(KNOWN_CONTROLLERS)) {
    if (name.includes(key)) return label;
  }
  return name;
}

export function MidiPanel() {
  const { isElectron, getMidiDevices } = useElectron();
  const [devices, setDevices] = useState<MidiDevices>({ inputs: [], outputs: [], total: 0 });
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMidiDevices();
      setDevices(result as MidiDevices);
    } finally {
      setLoading(false);
    }
  }, [getMidiDevices]);

  useEffect(() => { if (isElectron) scan(); }, [isElectron, scan]);

  if (!isElectron) return null;

  const hasDevices = devices.inputs.length > 0 || devices.outputs.length > 0;

  return (
    <div className="p-4 rounded-xl border border-white/5 flex flex-col gap-3" style={{ background: '#111118' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 size={14} className="text-purple-400" />
          <span className="text-sm font-medium text-white">MIDI Devices</span>
          {devices.total > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">{devices.total}</span>
          )}
        </div>
        <button onClick={scan} disabled={loading}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40">
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      {!hasDevices ? (
        <p className="text-xs text-gray-600 text-center py-3">No MIDI devices detected</p>
      ) : (
        <div className="space-y-1.5">
          {devices.inputs.map((d) => (
            <div key={`in-${d.id}`} className="flex items-center gap-2 text-xs">
              <Activity size={10} className="text-green-400 shrink-0" />
              <span className="text-gray-300 truncate flex-1">{detectController(d.name)}</span>
              <span className="text-gray-600 font-mono text-[10px] shrink-0">IN</span>
            </div>
          ))}
          {devices.outputs.map((d) => (
            <div key={`out-${d.id}`} className="flex items-center gap-2 text-xs">
              <Usb size={10} className="text-cyan-400 shrink-0" />
              <span className="text-gray-300 truncate flex-1">{detectController(d.name)}</span>
              <span className="text-gray-600 font-mono text-[10px] shrink-0">OUT</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SystemInfoPanel — CPU, RAM, platform info (desktop only)
// ============================================================
import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Monitor, Wifi, WifiOff } from 'lucide-react';
import { useElectron, type SystemInfo } from '../../hooks/useElectron';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function getPlatformLabel(platform: string): string {
  return platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform;
}

export function SystemInfoPanel() {
  const { isElectron, getSystemInfo, onPowerEvent } = useElectron();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [powerState, setPowerState] = useState<string>('unknown');

  useEffect(() => {
    if (!isElectron) return;
    getSystemInfo().then((i) => setInfo(i as SystemInfo));
  }, [isElectron, getSystemInfo]);

  useEffect(() => {
    if (!isElectron) return;
    onPowerEvent((event: string) => setPowerState(event));
  }, [isElectron, onPowerEvent]);

  if (!isElectron || !info) return null;

  const ramUsed = info.totalMemory - info.freeMemory;
  const ramPct  = (ramUsed / info.totalMemory) * 100;
  const onBattery = powerState === 'on-battery';
  const ramColor = ramPct > 85 ? '#ef4444' : ramPct > 65 ? '#f59e0b' : '#22c55e';

  return (
    <div className="p-4 rounded-xl border border-white/5 space-y-3" style={{ background: '#111118' }}>
      <div className="flex items-center gap-2">
        <Monitor size={14} className="text-purple-400" />
        <span className="text-sm font-medium text-white">System</span>
        <span className="text-xs text-gray-600 ml-auto font-mono">{getPlatformLabel(info.platform)} · {info.arch}</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <Cpu size={11} className="text-cyan-400 shrink-0" />
        <span className="text-gray-400">{info.cpus} CPU {info.cpus === 1 ? 'core' : 'cores'}</span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-3">
          <HardDrive size={11} className="text-amber-400 shrink-0" />
          <span className="text-gray-400">RAM <span className="text-gray-300">{formatBytes(ramUsed)}</span><span className="text-gray-600"> / {formatBytes(info.totalMemory)}</span></span>
          <span className="ml-auto text-gray-600 font-mono">{ramPct.toFixed(0)}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(ramPct, 100)}%`, background: ramColor }} />
        </div>
      </div>

      {powerState !== 'unknown' && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {onBattery ? <WifiOff size={10} className="text-amber-400" /> : <Wifi size={10} className="text-green-400" />}
          <span>{onBattery ? 'On battery' : powerState === 'resume' ? 'Resumed' : 'On AC power'}</span>
        </div>
      )}

      <div className="text-[10px] text-gray-700 font-mono truncate" title={info.hostname}>{info.hostname}</div>
    </div>
  );
}

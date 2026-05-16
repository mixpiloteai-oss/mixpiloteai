// ============================================================
// TitleBar — Custom frameless window title bar (cyberpunk style)
// Renders only on non-macOS Electron (Mac uses native traffic lights)
// ============================================================
import React, { useState, useCallback } from 'react';
import { Minus, Square, X, Pin } from 'lucide-react';
import { useElectron } from '../../hooks/useElectron';

export function TitleBar() {
  const { isElectron, platform, minimize, maximize, close, setAlwaysOnTop } = useElectron();
  const [isMaximized, setIsMaximized] = useState(false);
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false);

  if (!isElectron || platform === 'darwin') return null;

  const handleMaximize = useCallback(async () => {
    await maximize();
    setIsMaximized((prev) => !prev);
  }, [maximize]);

  const handlePin = useCallback(async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTopState(next);
    await setAlwaysOnTop(next);
  }, [alwaysOnTop, setAlwaysOnTop]);

  return (
    <div
      className="flex items-center justify-between h-8 px-3 select-none shrink-0"
      style={{
        background: '#0d0d14',
        WebkitAppRegion: 'drag',
        borderBottom: '1px solid rgba(124, 58, 237, 0.15)',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: 'radial-gradient(circle at 40% 40%, #a855f7, #7c3aed)', boxShadow: '0 0 6px rgba(168,85,247,0.6)' }}
        />
        <span className="text-xs font-mono text-purple-400/60 tracking-widest uppercase">NEUROTEK AI</span>
      </div>

      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={handlePin} title={alwaysOnTop ? 'Unpin window' : 'Pin on top'}
          className={['p-1.5 rounded transition-colors', alwaysOnTop ? 'text-purple-400 bg-purple-500/15' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'].join(' ')}>
          <Pin size={11} />
        </button>
        <button onClick={minimize} title="Minimize"
          className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
          <Minus size={11} />
        </button>
        <button onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}
          className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
          <Square size={11} />
        </button>
        <button onClick={close} title="Close"
          className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/15 transition-colors">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

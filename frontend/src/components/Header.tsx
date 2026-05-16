// ============================================================
// NEUROTEK AI — Header
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  Mic,
  Bell,
  Settings,
  ChevronDown,
  Gauge,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { VuMeter } from './ui/VuMeter';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const { activeProject, notifications, setView } = useAppStore();
  const { playbackState, bpm, masterVu, play, pause, stop } = useAudioEngine();
  const [showNotifs, setShowNotifs] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';

  return (
    <header
      className="flex-shrink-0 flex items-center gap-4 px-4 py-2.5 relative z-10"
      style={{
        background: 'rgba(10,10,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        height: 56,
      }}
    >
      {/* Project info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {activeProject ? (
          <>
            <div
              className="w-7 h-7 rounded flex-shrink-0"
              style={{ background: activeProject.coverColor }}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary truncate leading-tight">
                {activeProject.name}
              </h2>
              <p className="text-[10px] text-text-muted capitalize leading-tight">
                {activeProject.genre} · {activeProject.key}
              </p>
            </div>
          </>
        ) : (
          <span className="text-sm text-text-muted">No project selected</span>
        )}
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={stop}
          className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          title="Stop"
        >
          <SkipBack size={14} />
        </button>

        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={isPlaying ? pause : play}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{
            background: isPlaying ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.15)',
            border: `1px solid ${isPlaying ? 'rgba(239,68,68,0.4)' : 'rgba(124,58,237,0.4)'}`,
            color: isPlaying ? '#ef4444' : '#a78bfa',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </motion.button>

        <button
          onClick={stop}
          className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          title="Stop"
        >
          <Square size={13} />
        </button>
      </div>

      {/* BPM display */}
      <div
        className="flex flex-col items-center rounded-lg px-3 py-1 cursor-default select-none"
        style={{ background: 'rgba(15,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-[9px] text-text-muted uppercase tracking-wider">BPM</span>
        <span className="text-lg font-bold font-mono leading-tight" style={{
          background: 'linear-gradient(135deg, #a78bfa, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {bpm}
        </span>
      </div>

      {/* Position */}
      <div
        className="hidden md:flex flex-col items-center rounded-lg px-3 py-1"
        style={{ background: 'rgba(15,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-[9px] text-text-muted uppercase tracking-wider">Position</span>
        <span className="text-sm font-mono text-text-accent leading-tight">
          {isPlaying ? '32.1.00' : '01.1.00'}
        </span>
      </div>

      {/* Master VU */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">MASTER</span>
          <VuMeter state={masterVu} height={28} width={16} segments={8} showPeak={false} />
        </div>
      </div>

      {/* Playback state indicator */}
      <div className="flex items-center gap-1.5">
        <motion.div
          animate={isPlaying ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.3 }}
          transition={isPlaying ? { duration: 1, repeat: Infinity } : {}}
          className="w-2 h-2 rounded-full"
          style={{ background: isPlaying ? '#10b981' : isPaused ? '#f59e0b' : '#475569' }}
        />
        <span className="text-[10px] text-text-muted uppercase font-mono hidden sm:block">
          {playbackState}
        </span>
      </div>

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Divider */}
      <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors relative"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ background: '#ef4444', color: '#fff' }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {showNotifs && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-card z-50 overflow-hidden"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="text-xs font-semibold text-text-primary">Notifications</h4>
              </div>
              <div className="max-h-60 overflow-y-auto scroll-area">
                {notifications.length === 0 ? (
                  <p className="text-xs text-text-muted p-4 text-center">No notifications</p>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className={clsx(
                        'p-3 border-b border-white/5 text-xs',
                        !n.read && 'bg-white/2'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                          style={{
                            background:
                              n.type === 'success' ? '#10b981' :
                              n.type === 'error' ? '#ef4444' :
                              n.type === 'warning' ? '#f59e0b' : '#7c3aed',
                          }}
                        />
                        <p className="text-text-secondary">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setView('chat')}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}

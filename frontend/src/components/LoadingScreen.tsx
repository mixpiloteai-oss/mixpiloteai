// ============================================================
// NEUROTEK AI — Loading Screen
// ============================================================
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const bootMessages = [
  'Initialising Neural Core...',
  'Loading audio engine modules...',
  'Calibrating frequency analysis...',
  'Connecting AI inference engine...',
  'Loading genre model: MENTALCORE...',
  'Loading genre model: HARDTEK...',
  'Loading genre model: TRIBE...',
  'Loading FX preset database...',
  'Warming up VU meters...',
  'Configuring MIDI subsystem...',
  'System ready. Welcome, producer.',
];

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let p = 0;
    let msgIdx = 0;

    const interval = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setDone(true);
        setTimeout(onComplete, 600);
      }

      const newMsgIdx = Math.min(
        Math.floor((p / 100) * bootMessages.length),
        bootMessages.length - 1
      );
      if (newMsgIdx !== msgIdx) {
        msgIdx = newMsgIdx;
        setMessageIndex(msgIdx);
      }

      setProgress(Math.floor(p));
    }, 180);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0a0a0f' }}
    >
      {/* Scanline effect */}
      <div className="loading-scanline" />

      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124,58,237,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-md px-8">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-3"
        >
          {/* N glyph */}
          <div className="relative">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-4 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)' }}
            />
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <defs>
                <linearGradient id="nGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width="72" height="72" rx="16" fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.4)" strokeWidth="1.5" />
              <path
                d="M16 14v44M16 14l40 44M56 14v44"
                stroke="url(#nGrad)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-widest uppercase" style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 40%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              NEUROTEK AI
            </h1>
            <p className="text-xs text-text-muted tracking-[0.3em] uppercase mt-1">
              Future Music Production
            </p>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 12px rgba(124,58,237,0.6)',
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-mono text-text-muted"
              >
                {bootMessages[messageIndex]}
              </motion.p>
            </AnimatePresence>
            <span className="text-xs font-mono text-text-accent ml-4 tabular-nums">
              {progress}%
            </span>
          </div>
        </div>

        {/* Boot log */}
        <div
          className="w-full rounded-lg p-4 font-mono text-xs overflow-hidden"
          style={{ background: 'rgba(10,10,15,0.8)', border: '1px solid rgba(255,255,255,0.05)', height: 100 }}
        >
          {bootMessages.slice(0, messageIndex + 1).map((msg, i) => (
            <div key={i} className={i === messageIndex ? 'text-emerald-400' : 'text-text-muted opacity-50'}>
              {i === messageIndex ? (
                <>
                  <span className="text-violet-400">&gt; </span>
                  {msg}
                  <span className="animate-boot-blink">_</span>
                </>
              ) : (
                <>
                  <span className="text-text-muted">✓ </span>
                  {msg}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full"
            style={{ background: done ? '#10b981' : '#7c3aed' }}
          />
          <span className="text-xs text-text-muted font-mono">
            {done ? 'SYSTEM ONLINE' : 'LOADING...'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

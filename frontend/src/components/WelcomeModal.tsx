// ============================================================
// NEUROTEK AI — First-Launch Welcome Modal
// ============================================================
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, MessageSquare, Music2, X, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'neurotek_welcomed_v1';

const steps = [
  {
    icon: <Sparkles size={32} style={{ color: '#a78bfa' }} />,
    title: 'Welcome to NeuroTek AI',
    subtitle: 'v1.0.0-beta.1',
    body: 'The first AI-native DAW built for underground electronic music. Generate beats, arrange tracks, and produce full sessions — all powered by AI trained on your genres.',
  },
  {
    icon: <Music2 size={32} style={{ color: '#06b6d4' }} />,
    title: 'Your genres, your rules',
    body: 'NeuroTek AI is trained on Tribe, Tekno, Hardtek, Mentalcore, and more. Select your genre and BPM and let the AI handle the heavy lifting.',
  },
  {
    icon: <MessageSquare size={32} style={{ color: '#10b981' }} />,
    title: 'AI Chat is your co-producer',
    body: 'Hit ⌘+\ to open AI Chat anywhere. Ask for a bassline, mix feedback, a new arrangement idea — it knows your project context.',
  },
  {
    icon: <Download size={32} style={{ color: '#f59e0b' }} />,
    title: 'This is a beta build',
    body: 'You\'re one of the first producers to try NeuroTek AI. Bugs are expected — use Help → Report Bug to send logs. Your feedback directly shapes the roadmap.',
  },
];

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function close() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setVisible(false);
  }

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1);
    else close();
  }

  const current = steps[step];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            style={{
              width: '100%', maxWidth: 480,
              background: 'linear-gradient(145deg, #12122a 0%, #0e0e1e 100%)',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 20,
              padding: '40px 40px 32px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(124,58,237,0.1)',
              position: 'relative',
            }}
          >
            {/* Close */}
            <button
              onClick={close}
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: i <= step
                    ? 'linear-gradient(90deg, #7c3aed, #06b6d4)'
                    : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <div style={{ marginBottom: 20 }}>{current.icon}</div>
                <h2 style={{
                  fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em',
                  color: '#f1f5f9', marginBottom: 4,
                }}>
                  {current.title}
                </h2>
                {current.subtitle && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: '#a78bfa',
                    display: 'block', marginBottom: 16,
                  }}>
                    {current.subtitle}
                  </span>
                )}
                <p style={{
                  fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75,
                  marginTop: current.subtitle ? 0 : 12,
                }}>
                  {current.body}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
              <button
                onClick={close}
                style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.35)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Skip intro
              </button>
              <button
                onClick={next}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                }}
              >
                {step < steps.length - 1 ? 'Next' : 'Start producing'}
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

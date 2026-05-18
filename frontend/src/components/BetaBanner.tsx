// ============================================================
// NEUROTEK AI — Beta Build Banner
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, X, ExternalLink } from 'lucide-react';

const DISMISS_KEY = 'neurotek_beta_banner_dismissed';

export function BetaBanner() {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(DISMISS_KEY); } catch { return true; }
  });

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'linear-gradient(90deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))',
            borderBottom: '1px solid rgba(124,58,237,0.2)',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                <strong style={{ color: '#a78bfa' }}>v1.0.0-beta.1</strong>
                {' '}— Beta build. Bugs are expected.{' '}
                <button
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal('https://github.com/mixpiloteai-oss/mixpiloteai/issues');
                    }
                  }}
                  style={{
                    color: '#06b6d4', background: 'none', border: 'none',
                    cursor: 'pointer', textDecoration: 'underline', fontSize: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                >
                  Report a bug <ExternalLink size={10} />
                </button>
              </span>
            </div>
            <button
              onClick={dismiss}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                padding: 2, borderRadius: 4,
              }}
              aria-label="Dismiss beta banner"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

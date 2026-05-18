// ============================================================
// NEUROTEK AI — Update Checker (placeholder for auto-updater)
// ============================================================
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, RefreshCw } from 'lucide-react';

interface UpdateInfo {
  version: string;
  notes: string;
  url: string;
}

export function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // In production this would call window.electronAPI.checkUpdate()
    // which triggers electron-updater. For beta, we do a lightweight
    // fetch to a version endpoint (placeholder).
    const timer = setTimeout(() => checkForUpdate(), 30_000);
    return () => clearTimeout(timer);
  }, []);

  async function checkForUpdate() {
    setChecking(true);
    try {
      // Placeholder: in production replace with real version endpoint
      if (window.electronAPI?.checkUpdate) {
        const result = await window.electronAPI.checkUpdate();
        if (result?.hasUpdate) {
          setUpdate({ version: result.version, notes: result.releaseNotes ?? '', url: result.downloadUrl ?? '' });
        }
      }
    } catch {
      // Silently ignore — update check is non-critical
    } finally {
      setChecking(false);
    }
  }

  if (!update || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: 'linear-gradient(145deg, #1a1a3e, #12122a)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 14, padding: '16px 20px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          maxWidth: 320, width: '100%',
        }}
      >
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'rgba(124,58,237,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
              Update available: v{update.version}
            </p>
            {update.notes && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.5 }}>
                {update.notes.slice(0, 80)}{update.notes.length > 80 ? '…' : ''}
              </p>
            )}
            <button
              onClick={() => window.electronAPI?.openExternal?.(update.url)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                border: 'none', color: '#fff', cursor: 'pointer',
              }}
            >
              Download update
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================
// NEUROTEK AI — Sessions Panel
// Shows all active device sessions and allows individual
// or bulk revocation.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../services/api';

interface Session {
  id: string;
  deviceName: string;
  deviceType: 'browser' | 'mobile' | 'desktop' | 'api';
  ipAddress: string | null;
  lastSeenAt: number;
  createdAt: number;
  expiresAt: number;
}

function DeviceIcon({ type }: { type: Session['deviceType'] }) {
  const icons: Record<Session['deviceType'], string> = {
    browser: '🌐',
    mobile:  '📱',
    desktop: '🖥️',
    api:     '⚙️',
  };
  return <span className="text-xl">{icons[type] ?? '💻'}</span>;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000)  return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface SessionsPanelProps {
  /** Called after all sessions are revoked (e.g. to redirect to login) */
  onAllRevoked?: () => void;
}

export default function SessionsPanel({ onAllRevoked }: SessionsPanelProps) {
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [loading, setLoading]       = useState(true);
  const [revoking, setRevoking]     = useState<string | null>(null); // session ID being revoked
  const [error, setError]           = useState<string | null>(null);
  const [notification, setNotif]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.sessions();
      setSessions((res.data as { data: Session[] }).data ?? []);
    } catch {
      setError('Failed to load sessions. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function showNotif(msg: string) {
    setNotif(msg);
    setTimeout(() => setNotif(null), 3000);
  }

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      showNotif('Session revoked');
    } catch {
      setError('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    if (!confirm('Sign out all other sessions? You will need to log in again on each device.')) return;
    setRevoking('all');
    try {
      await authApi.revokeAllSessions();
      setSessions([]);
      showNotif('All sessions revoked');
      onAllRevoked?.();
    } catch {
      setError('Failed to revoke all sessions');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Active Sessions</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors px-2 py-1 rounded"
          >
            ↻ Refresh
          </button>
          {sessions.length > 1 && (
            <button
              onClick={() => void revokeAll()}
              disabled={revoking === 'all'}
              className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors
                         bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg border border-red-800/40"
            >
              {revoking === 'all' ? 'Revoking…' : 'Sign Out All'}
            </button>
          )}
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-green-900/20 border border-green-800/40 rounded-lg px-4 py-2 text-green-400 text-sm"
          >
            ✓ {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sessions list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#1a1a25] border border-[#2d2d3d] rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#2d2d3d] rounded-full" />
                <div className="flex-1">
                  <div className="h-3 bg-[#2d2d3d] rounded w-32 mb-2" />
                  <div className="h-2 bg-[#2d2d3d] rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">No active sessions</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {sessions.map((session, idx) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-[#1a1a25] border border-[#2d2d3d] hover:border-[#3d3d5d]
                           rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Device icon */}
                  <div className="w-10 h-10 bg-[#0d0d16] rounded-full flex items-center justify-center flex-shrink-0">
                    <DeviceIcon type={session.deviceType} />
                  </div>

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-100 text-sm font-medium truncate">{session.deviceName}</p>
                      {idx === 0 && (
                        <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-500/30 flex-shrink-0">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {session.ipAddress && (
                        <span className="text-slate-500 text-xs font-mono">{session.ipAddress}</span>
                      )}
                      <span className="text-slate-500 text-xs">
                        Last active: {timeAgo(session.lastSeenAt)}
                      </span>
                    </div>
                  </div>

                  {/* Revoke button */}
                  {idx !== 0 && (
                    <button
                      onClick={() => void revokeSession(session.id)}
                      disabled={revoking === session.id}
                      className="flex-shrink-0 text-red-400/70 hover:text-red-400 text-xs
                                 transition-colors px-2 py-1.5 rounded hover:bg-red-900/20"
                      title="Revoke this session"
                    >
                      {revoking === session.id ? (
                        <span className="w-3 h-3 border border-red-400/40 border-t-red-400 rounded-full animate-spin inline-block" />
                      ) : '✕ Sign out'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Security tip */}
      <p className="text-slate-600 text-xs text-center pt-2">
        🔒 Session tokens are hashed before storage. We never store plaintext refresh tokens.
      </p>
    </div>
  );
}

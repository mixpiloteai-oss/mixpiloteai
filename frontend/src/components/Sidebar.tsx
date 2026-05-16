// ============================================================
// NEUROTEK AI — Sidebar
// ============================================================
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Files,
  Music2,
  SlidersHorizontal,
  Radio,
  Bot,
  ChevronLeft,
  ChevronRight,
  Zap,
  Circle,
  LogOut,
  Package,
  Cpu,
  GraduationCap,
  BarChart2,
  CreditCard,
  Scale,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { authApi, clearTokens } from '../services/api';
import { QuotaPanel } from './QuotaPanel';
import type { ViewType } from '../types';

interface NavItem {
  id: ViewType;
  labelKey: string;
  icon: React.ReactNode;
  badge?: string;
  color?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  labelKey: 'nav.dashboard',  icon: <LayoutDashboard size={18} />, color: '#7c3aed' },
  { id: 'templates',  labelKey: 'nav.templates',  icon: <Files size={18} />,           color: '#06b6d4' },
  { id: 'tracks',     labelKey: 'nav.tracks',     icon: <Music2 size={18} />,          color: '#f59e0b' },
  { id: 'mix',        labelKey: 'nav.mix',        icon: <SlidersHorizontal size={18} />, color: '#10b981' },
  { id: 'live',       labelKey: 'nav.live',       icon: <Radio size={18} />,           badge: 'LIVE', color: '#ef4444' },
  { id: 'chat',       labelKey: 'nav.chat',       icon: <Bot size={18} />,             color: '#ec4899' },
  { id: 'coach',      labelKey: 'nav.coach',      icon: <GraduationCap size={18} />,   color: '#7c3aed' },
  { id: 'packs',      labelKey: 'nav.packs',      icon: <Package size={18} />,         color: '#10b981' },
  { id: 'daw',        labelKey: 'nav.daw',        icon: <Cpu size={18} />,             color: '#f59e0b' },
  { id: 'analytics',  labelKey: 'nav.analytics',  icon: <BarChart2 size={18} />,       color: '#7c3aed' },
  { id: 'plans',      labelKey: 'nav.plans',      icon: <CreditCard size={18} />,      color: '#06b6d4' },
  { id: 'legal',      labelKey: 'nav.legal',      icon: <Scale size={18} />,           color: '#6b7280' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { currentView, setView, sidebarCollapsed, toggleSidebar, activeProject, audioEngine, auth, clearAuth } = useAppStore();

  // Handle neurotek:navigate custom events dispatched from child components
  React.useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent<string>).detail as ViewType;
      if (view) setView(view);
    };
    window.addEventListener('neurotek:navigate', handler);
    return () => window.removeEventListener('neurotek:navigate', handler);
  }, [setView]);

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearTokens();
    clearAuth();
  }
  const isPlaying = audioEngine.playbackState === 'playing';

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        background: 'rgba(10,10,15,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 min-w-0"
            >
              <div className="relative flex-shrink-0">
                <svg width="32" height="32" viewBox="0 0 72 72" fill="none">
                  <rect width="72" height="72" rx="14" fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.4)" strokeWidth="1.5"/>
                  <path d="M16 14v44M16 14l40 44M56 14v44" stroke="url(#sg)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a78bfa"/>
                      <stop offset="100%" stopColor="#7c3aed"/>
                    </linearGradient>
                  </defs>
                </svg>
                {isPlaying && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-wider" style={{
                  background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  NEUROTEK
                </div>
                <div className="text-[9px] text-text-muted tracking-widest uppercase">AI Studio</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sidebarCollapsed && (
          <div className="mx-auto">
            <svg width="28" height="28" viewBox="0 0 72 72" fill="none">
              <rect width="72" height="72" rx="14" fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.4)" strokeWidth="1.5"/>
              <path d="M16 14v44M16 14l40 44M56 14v44" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          style={sidebarCollapsed ? { position: 'absolute', right: 8, top: 18 } : {}}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Active project indicator */}
      <AnimatePresence>
        {!sidebarCollapsed && activeProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-3 rounded-lg p-2.5 overflow-hidden"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: activeProject.coverColor.includes('gradient')
                    ? '#7c3aed'
                    : activeProject.coverColor,
                }}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-accent truncate">{activeProject.name}</p>
                <p className="text-[10px] text-text-muted font-mono">{activeProject.bpm} BPM</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto scroll-area">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={clsx(
                'w-full flex items-center rounded-lg transition-all duration-150 group',
                sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
              style={
                isActive
                  ? {
                      background: `${item.color}18`,
                      border: `1px solid ${item.color}35`,
                      boxShadow: `0 0 12px ${item.color}15`,
                      color: item.color,
                    }
                  : { border: '1px solid transparent' }
              }
              title={sidebarCollapsed ? t(item.labelKey) : undefined}
            >
              <span
                className="flex-shrink-0 transition-colors"
                style={isActive ? { color: item.color } : {}}
              >
                {item.icon}
              </span>

              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex items-center justify-between min-w-0"
                  >
                    <span className="text-sm font-medium truncate">{t(item.labelKey)}</span>
                    {item.badge && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${item.color}25`,
                          color: item.color,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Quota panel */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pb-1"
          >
            <QuotaPanel compact />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom status + user */}
      <div
        className="p-3 space-y-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {!sidebarCollapsed ? (
          <>
            {auth.user && (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-text-primary font-medium truncate">{auth.user.name}</p>
                  <p className="text-[10px] text-text-muted truncate">{auth.user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-amber-400" />
                <span>AI Engine</span>
              </div>
              <div className="flex items-center gap-1">
                <Circle size={8} className="fill-emerald-400 text-emerald-400" />
                <span className="text-emerald-400">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>Latency</span>
              <span className="font-mono text-text-accent">{audioEngine.latency.toFixed(1)}ms</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Circle size={8} className="fill-emerald-400 text-emerald-400" />
            <button
              onClick={handleLogout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

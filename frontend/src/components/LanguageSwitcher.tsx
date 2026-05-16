// ============================================================
// NEUROTEK AI — Language Switcher
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language.split('-')[0])
    ?? SUPPORTED_LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(code: string) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
        style={{
          background: open ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
        }}
        title={t('common.language')}
      >
        <Globe size={13} className="flex-shrink-0" />
        <span className="text-xs font-medium hidden sm:inline">{current.flag} {current.name}</span>
        <span className="text-xs font-medium sm:hidden">{current.flag}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown size={11} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{
              background: 'rgba(16,16,28,0.98)',
              border: '1px solid rgba(124,58,237,0.2)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)',
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Globe size={12} style={{ color: '#7c3aed' }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {t('common.language')}
              </span>
            </div>

            {/* Language list */}
            <div className="py-1 max-h-72 overflow-y-auto scroll-area">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = current.code === lang.code;
                return (
                  <motion.button
                    key={lang.code}
                    whileHover={{ x: 2 }}
                    onClick={() => handleSelect(lang.code)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{
                      background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                      color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.7)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <span className="text-base leading-none flex-shrink-0">{lang.flag}</span>
                    <span className="text-xs font-medium flex-1">{lang.name}</span>
                    <span className="text-[10px] font-mono text-text-muted uppercase">{lang.code}</span>
                    {isActive && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <Check size={12} style={{ color: '#7c3aed' }} />
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Footer glow */}
            <div
              className="h-px w-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

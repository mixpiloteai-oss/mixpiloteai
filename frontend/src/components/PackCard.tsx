// ============================================================
// NEUROTEK AI — Pack Card Component
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Play,
  Heart,
  Star,
  Package,
  CheckCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PACK_TYPE_COLORS, PACK_TYPE_LABELS, PackType } from '../data/builtinPacks';

export interface PackCardData {
  id: string;
  name: string;
  description: string;
  author: string;
  type: string;
  genre: string[];
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  isBuiltin: boolean;
  isFree: boolean;
  fileSize: string;
  version: string;
}

interface PackCardProps {
  pack: PackCardData;
  onDownload?: (id: string) => void;
  onPreview?: (id: string) => void;
  downloaded?: boolean;
}

export function PackCard({ pack, onDownload, onPreview, downloaded = false }: PackCardProps) {
  const { t } = useTranslation();
  const [liked, setLiked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(downloaded);

  const typeColor = PACK_TYPE_COLORS[pack.type as PackType] ?? '#7c3aed';
  const typeLabel = PACK_TYPE_LABELS[pack.type as PackType] ?? pack.type;

  async function handleDownload() {
    if (downloading || justDownloaded) return;
    setDownloading(true);
    try {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
      onDownload?.(pack.id);
      setJustDownloaded(true);
    } finally {
      setDownloading(false);
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={10}
            className="flex-shrink-0"
            style={{
              fill: star <= Math.round(rating) ? '#f59e0b' : 'transparent',
              color: star <= Math.round(rating) ? '#f59e0b' : '#374151',
            }}
          />
        ))}
        <span className="text-[10px] text-text-muted ml-1 font-mono">{rating.toFixed(1)}</span>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-xl overflow-hidden group"
      style={{
        background: 'rgba(15,15,26,0.8)',
        border: `1px solid rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${typeColor}60, ${typeColor}20, transparent)` }}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Type badge + free badge */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: `${typeColor}20`, color: typeColor, border: `1px solid ${typeColor}30` }}
            >
              {typeLabel}
            </span>
            {pack.isFree ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                {t('packs.free')}
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Lock size={8} />PRO
              </span>
            )}
            {pack.isBuiltin && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                Official
              </span>
            )}
          </div>

          {/* Like button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setLiked((v) => !v)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: liked ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)',
              border: liked ? '1px solid rgba(236,72,153,0.3)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Heart
              size={12}
              style={{ fill: liked ? '#ec4899' : 'transparent', color: liked ? '#ec4899' : '#6b7280' }}
            />
          </motion.button>
        </div>

        {/* Pack name + description */}
        <h3 className="text-sm font-semibold text-text-primary mb-1 leading-tight">{pack.name}</h3>
        <p className="text-[11px] text-text-muted leading-relaxed mb-3 line-clamp-2">{pack.description}</p>

        {/* Author */}
        <div className="flex items-center gap-1.5 mb-3">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ background: `${typeColor}20`, color: typeColor }}
          >
            {pack.author.charAt(0).toUpperCase()}
          </div>
          <span className="text-[11px] text-text-muted">
            {t('packs.by')} <span className="text-text-secondary">{pack.author}</span>
          </span>
        </div>

        {/* Genre tags */}
        {pack.genre.length > 0 && pack.genre[0] !== 'all' && (
          <div className="flex flex-wrap gap-1 mb-3">
            {pack.genre.slice(0, 3).map((g) => (
              <span
                key={g}
                className="text-[9px] px-1.5 py-0.5 rounded capitalize"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between mb-3">
          {renderStars(pack.rating)}
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Download size={10} />
            <span className="font-mono">{pack.downloads.toLocaleString()}</span>
          </div>
        </div>

        {/* File info */}
        <div className="flex items-center justify-between mb-4 text-[10px] text-text-muted">
          <span className="font-mono">v{pack.version}</span>
          <span>{pack.fileSize}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Preview button */}
          <button
            onClick={() => onPreview?.(pack.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#6b7280',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            <Play size={10} />
            {t('packs.preview')}
          </button>

          {/* Download button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleDownload}
            disabled={downloading || justDownloaded}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200"
            style={
              justDownloaded
                ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }
                : downloading
                ? { background: `${typeColor}15`, border: `1px solid ${typeColor}30`, color: typeColor, opacity: 0.7 }
                : { background: `${typeColor}20`, border: `1px solid ${typeColor}35`, color: typeColor }
            }
          >
            <AnimatePresence mode="wait">
              {downloading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" />
                  {t('common.loading')}
                </motion.span>
              ) : justDownloaded ? (
                <motion.span key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5">
                  <CheckCircle size={10} />
                  {t('packs.downloaded')}
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                  <Download size={10} />
                  {t('packs.download')}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

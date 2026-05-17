// ============================================================
// NEUROTEK AI — Sample Browser Panel
// Desktop file-system sample browser with favorites & search
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderOpen, Music2, Search, ChevronRight, ChevronDown,
  Play, Heart, HardDrive,
} from 'lucide-react';
import { useElectron } from '../hooks/useElectron';

// ── Types ─────────────────────────────────────────────────────

interface SampleFile {
  id: string; name: string; path: string; ext: string;
  size: number; durationMs?: number; bpm?: number; key?: string; tags: string[];
}

interface SampleFolder {
  id: string; name: string; path: string;
  children: SampleFolder[]; files: SampleFile[]; expanded: boolean;
}

type SortKey = 'name' | 'size' | 'bpm';

// ── Demo library ──────────────────────────────────────────────

const DEMO_SAMPLES: SampleFolder[] = [
  {
    id: 'kicks', name: 'Kicks', path: '/demo/kicks', expanded: false, children: [],
    files: [
      { id: 'k1', name: 'Hardtek Kick 01.wav', path: '/demo/kicks/k1.wav', ext: '.wav', size: 48000, bpm: 170, tags: ['kick', 'hardtek', 'distorted'] },
      { id: 'k2', name: 'Mental Kick 01.wav',  path: '/demo/kicks/k2.wav', ext: '.wav', size: 52000, bpm: 200, tags: ['kick', 'mental', 'punchy'] },
      { id: 'k3', name: 'Tribe Kick 01.wav',   path: '/demo/kicks/k3.wav', ext: '.wav', size: 44000, bpm: 150, tags: ['kick', 'tribe', 'woody'] },
      { id: 'k4', name: 'Industrial Kick.wav', path: '/demo/kicks/k4.wav', ext: '.wav', size: 55000, bpm: 160, tags: ['kick', 'industrial'] },
    ],
  },
  {
    id: 'basses', name: 'Basses', path: '/demo/basses', expanded: false, children: [],
    files: [
      { id: 'b1', name: 'Acid Bass 303.wav',   path: '/demo/basses/b1.wav', ext: '.wav', size: 120000, tags: ['bass', 'acid', '303'] },
      { id: 'b2', name: 'Dark Sub Bass.wav',   path: '/demo/basses/b2.wav', ext: '.wav', size: 95000,  tags: ['bass', 'sub', 'dark'] },
      { id: 'b3', name: 'Tekno Bass Riff.wav', path: '/demo/basses/b3.wav', ext: '.wav', size: 88000,  tags: ['bass', 'tekno'] },
    ],
  },
  {
    id: 'fx', name: 'FX & Stabs', path: '/demo/fx', expanded: false, children: [],
    files: [
      { id: 'f1', name: 'Riser 01.wav',         path: '/demo/fx/f1.wav', ext: '.wav', size: 200000, tags: ['fx', 'riser'] },
      { id: 'f2', name: 'Impact Boom.wav',       path: '/demo/fx/f2.wav', ext: '.wav', size: 180000, tags: ['fx', 'impact'] },
      { id: 'f3', name: 'Industrial Clank.wav',  path: '/demo/fx/f3.wav', ext: '.wav', size: 35000,  tags: ['fx', 'industrial'] },
      { id: 'f4', name: 'Noise Sweep.wav',       path: '/demo/fx/f4.wav', ext: '.wav', size: 250000, tags: ['fx', 'sweep'] },
    ],
  },
  {
    id: 'percs', name: 'Percussion', path: '/demo/percs', expanded: false, children: [],
    files: [
      { id: 'p1', name: 'Shaker 01.wav',       path: '/demo/percs/p1.wav', ext: '.wav', size: 22000, tags: ['perc', 'shaker'] },
      { id: 'p2', name: 'Conga Hi.wav',        path: '/demo/percs/p2.wav', ext: '.wav', size: 35000, tags: ['perc', 'conga'] },
      { id: 'p3', name: 'Mental HH Loop.wav',  path: '/demo/percs/p3.wav', ext: '.wav', size: 96000, bpm: 200, tags: ['perc', 'hihat', 'loop'] },
      { id: 'p4', name: 'Clap Distorted.wav',  path: '/demo/percs/p4.wav', ext: '.wav', size: 28000, tags: ['perc', 'clap'] },
    ],
  },
  {
    id: 'loops', name: 'Loops & Stems', path: '/demo/loops', expanded: false, children: [],
    files: [
      { id: 'l1', name: 'Hardtek Loop 170.wav', path: '/demo/loops/l1.wav', ext: '.wav', size: 480000, bpm: 170, tags: ['loop', 'hardtek'] },
      { id: 'l2', name: 'Tribal Groove.wav',    path: '/demo/loops/l2.wav', ext: '.wav', size: 520000, bpm: 150, tags: ['loop', 'tribe', 'groove'] },
      { id: 'l3', name: 'Industrial Beat.wav',  path: '/demo/loops/l3.wav', ext: '.wav', size: 440000, bpm: 160, tags: ['loop', 'industrial'] },
    ],
  },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

// ── FolderRow ─────────────────────────────────────────────────

function FolderRow({
  folder, depth, onToggle, selectedFile, onFileSelect, favorites, onToggleFavorite,
}: {
  folder: SampleFolder; depth: number; onToggle: (id: string) => void;
  selectedFile: SampleFile | null; onFileSelect: (f: SampleFile) => void;
  favorites: Set<string>; onToggleFavorite: (id: string) => void;
}) {
  return (
    <div>
      <motion.button
        onClick={() => onToggle(folder.id)} whileTap={{ scale: 0.98 }}
        className="flex items-center gap-1.5 w-full text-left py-1 px-2 rounded text-xs"
        style={{ paddingLeft: `${(depth + 1) * 12}px`, color: '#94a3b8' }}
      >
        {folder.expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {folder.expanded
          ? <FolderOpen size={12} style={{ color: '#f59e0b' }} />
          : <Folder size={12} style={{ color: '#f59e0b' }} />}
        <span className="font-medium">{folder.name}</span>
        <span className="ml-auto text-xs" style={{ color: '#475569' }}>{folder.files.length}</span>
      </motion.button>

      <AnimatePresence>
        {folder.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {folder.files.map((file) => (
              <motion.div
                key={file.id} onClick={() => onFileSelect(file)}
                whileHover={{ background: 'rgba(255,255,255,0.04)' }}
                className="flex items-center gap-1.5 py-0.5 px-2 cursor-pointer rounded text-xs"
                style={{
                  paddingLeft: `${(depth + 2) * 12}px`,
                  background: selectedFile?.id === file.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: selectedFile?.id === file.id ? '#a78bfa' : '#64748b',
                }}
              >
                <Music2 size={10} style={{ flexShrink: 0 }} />
                <span className="flex-1 truncate">{file.name}</span>
                {file.bpm && <span style={{ color: '#334155', fontSize: 9 }}>{file.bpm}</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(file.id); }}
                  style={{ color: favorites.has(file.id) ? '#ef4444' : '#334155', flexShrink: 0 }}
                >
                  <Heart size={9} fill={favorites.has(file.id) ? '#ef4444' : 'none'} />
                </button>
              </motion.div>
            ))}
            {folder.children.map((child) => (
              <FolderRow key={child.id} folder={child} depth={depth + 1}
                onToggle={onToggle} selectedFile={selectedFile} onFileSelect={onFileSelect}
                favorites={favorites} onToggleFavorite={onToggleFavorite}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function SampleBrowserPanel() {
  const electron = useElectron();
  const [folders, setFolders] = useState<SampleFolder[]>(DEMO_SAMPLES);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<SampleFile | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [cacheStats, setCacheStats] = useState<{ totalSizeMB: number; entryCount: number } | null>(null);

  useEffect(() => {
    electron.audioCacheStats().then((s) => setCacheStats(s)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFolder = useCallback((id: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, expanded: !f.expanded } : f));
  }, []);

  const toggleFavorite = useCallback((fileId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  }, []);

  const allFiles = folders.flatMap((f) => f.files);
  const filteredFiles = allFiles.filter((f) => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchFav = !filterFavorites || favorites.has(f.id);
    return matchSearch && matchFav;
  });
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'size') return b.size - a.size;
    if (sortKey === 'bpm')  return (b.bpm ?? 0) - (a.bpm ?? 0);
    return 0;
  });
  const isSearching = search.length > 0 || filterFavorites;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: '#0a0a0f', color: '#e2e8f0' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b"
        style={{ height: 44, borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
      >
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tracking-widest"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          <HardDrive size={10} />
          SAMPLE BROWSER
        </div>
        {cacheStats && (
          <span className="text-xs ml-auto" style={{ color: '#334155' }}>
            Cache: {cacheStats.totalSizeMB}MB · {cacheStats.entryCount} files
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5 flex-1 rounded px-2 py-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Search size={12} style={{ color: '#475569', flexShrink: 0 }} />
          <input
            type="text" placeholder="Search samples, tags…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs" style={{ color: '#e2e8f0', minWidth: 0 }}
          />
        </div>
        <motion.button
          onClick={() => setFilterFavorites((f) => !f)} whileTap={{ scale: 0.9 }}
          className="w-7 h-7 flex items-center justify-center rounded"
          style={{
            background: filterFavorites ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${filterFavorites ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            color: filterFavorites ? '#ef4444' : '#64748b',
          }}
          title="Show favorites"
        >
          <Heart size={11} fill={filterFavorites ? '#ef4444' : 'none'} />
        </motion.button>
        <select
          value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="text-xs rounded px-1 py-1 outline-none"
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="bpm">BPM</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Folder tree */}
        <div
          className="flex flex-col shrink-0 overflow-y-auto border-r py-1"
          style={{ width: 220, borderColor: 'rgba(255,255,255,0.08)', background: '#0c0c14' }}
        >
          {folders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} depth={0}
              onToggle={toggleFolder} selectedFile={selectedFile} onFileSelect={setSelectedFile}
              favorites={favorites} onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

        {/* Results / empty state */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {isSearching ? (
            <>
              <div className="px-3 py-1.5 text-xs border-b shrink-0" style={{ color: '#475569', borderColor: 'rgba(255,255,255,0.06)' }}>
                {sortedFiles.length} result{sortedFiles.length !== 1 ? 's' : ''}
              </div>
              <div className="flex-1 overflow-y-auto">
                {sortedFiles.map((file) => (
                  <motion.div
                    key={file.id} onClick={() => setSelectedFile(file)}
                    whileHover={{ background: 'rgba(255,255,255,0.04)' }}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.04)', background: selectedFile?.id === file.id ? 'rgba(124,58,237,0.12)' : 'transparent' }}
                  >
                    <Music2 size={11} style={{ color: '#475569', flexShrink: 0 }} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate" style={{ color: '#cbd5e1' }}>{file.name}</span>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {file.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1 rounded" style={{ background: 'rgba(124,58,237,0.15)', color: '#7c3aed', fontSize: 9 }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    {file.bpm && <span style={{ color: '#475569', flexShrink: 0 }}>{file.bpm}</span>}
                    <span style={{ color: '#334155', flexShrink: 0 }}>{formatSize(file.size)}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file.id); }} style={{ color: favorites.has(file.id) ? '#ef4444' : '#334155', flexShrink: 0 }}>
                      <Heart size={10} fill={favorites.has(file.id) ? '#ef4444' : 'none'} />
                    </button>
                  </motion.div>
                ))}
                {!sortedFiles.length && (
                  <div className="flex items-center justify-center h-32 text-sm" style={{ color: '#334155' }}>No samples found</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: '#334155' }}>
              <Search size={28} style={{ opacity: 0.3 }} />
              <p className="text-sm">Search or browse samples</p>
              <p className="text-xs" style={{ color: '#1e293b' }}>Click a folder to expand · Click a file to preview</p>
            </div>
          )}

          {/* File info bar */}
          {selectedFile && (
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="shrink-0 border-t px-3 py-2"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-medium truncate" style={{ color: '#e2e8f0' }}>{selectedFile.name}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: '#475569' }}>
                    <span>{selectedFile.ext}</span>
                    <span>{formatSize(selectedFile.size)}</span>
                    {selectedFile.bpm && <span>{selectedFile.bpm} BPM</span>}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  className="w-7 h-7 flex items-center justify-center rounded"
                  style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}
                  title="Preview"
                >
                  <Play size={10} />
                </motion.button>
                <motion.button onClick={() => toggleFavorite(selectedFile.id)} whileTap={{ scale: 0.9 }}
                  className="w-7 h-7 flex items-center justify-center rounded"
                  style={{
                    background: favorites.has(selectedFile.id) ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${favorites.has(selectedFile.id) ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                    color: favorites.has(selectedFile.id) ? '#ef4444' : '#64748b',
                  }}
                  title="Favorite"
                >
                  <Heart size={10} fill={favorites.has(selectedFile.id) ? '#ef4444' : 'none'} />
                </motion.button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedFile.tags.map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 10 }}>{tag}</span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

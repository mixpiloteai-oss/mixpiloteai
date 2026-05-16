// ============================================================
// NEUROTEK AI — DAW Bridge Component
// ============================================================
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Download,
  Upload,
  Music,
  Sliders,
  BookOpen,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  Info,
  Lightbulb,
  Star,
  FileText,
  Keyboard,
  PlugZap,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DAWS, DawInfo, MIDI_CONTROLLERS } from '../data/dawData';

type DawTab = 'export' | 'import' | 'midi' | 'guide';

export function DAWBridge() {
  const { t } = useTranslation();
  const [selectedDaw, setSelectedDaw] = useState<DawInfo>(DAWS[0]);
  const [activeTab, setActiveTab] = useState<DawTab>('export');
  const [exportComplete, setExportComplete] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport(formatLabel: string) {
    const template = {
      neurotek_version: '0.2.0',
      daw: selectedDaw.id,
      format: selectedDaw.exportFormat,
      exportedAt: new Date().toISOString(),
      tracks: [
        { name: 'Kick', type: 'kick', volume: 100, pan: 0 },
        { name: 'Bass', type: 'bass', volume: 90, pan: 0 },
        { name: 'Melody', type: 'melody', volume: 80, pan: 10 },
        { name: 'FX', type: 'fx', volume: 70, pan: -10 },
        { name: 'Master', type: 'master', volume: 100, pan: 0 },
      ],
      bpm: 145,
      key: 'Am',
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neurotek-template${selectedDaw.exportFormat}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setExportComplete(true);
    setTimeout(() => setExportComplete(false), 3000);
  }

  function handleExportAll() {
    setExportingAll(true);
    setTimeout(() => {
      handleExport('all');
      setExportingAll(false);
    }, 1200);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    }, 1500);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    }, 1500);
  }

  const tabs: { id: DawTab; label: string; icon: React.ReactNode }[] = [
    { id: 'export', label: t('daw.export'), icon: <Download size={14} /> },
    { id: 'import', label: t('daw.import'), icon: <Upload size={14} /> },
    { id: 'midi', label: t('daw.midiMapping'), icon: <Keyboard size={14} /> },
    { id: 'guide', label: t('daw.guide'), icon: <BookOpen size={14} /> },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: DAW selector */}
      <div
        className="flex-shrink-0 w-64 flex flex-col overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,16,0.6)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Cpu size={16} style={{ color: '#f59e0b' }} />
            {t('daw.title')}
          </h1>
          <p className="text-[10px] text-text-muted mt-0.5">{t('daw.subtitle')}</p>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            {t('daw.selectDaw')}
          </p>
          {DAWS.map((daw) => {
            const isSelected = selectedDaw.id === daw.id;
            return (
              <motion.button
                key={daw.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDaw(daw)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={
                  isSelected
                    ? {
                        background: `${daw.color}15`,
                        border: `1px solid ${daw.color}30`,
                        boxShadow: `0 0 12px ${daw.color}10`,
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                      }
                }
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{
                    background: isSelected ? `${daw.color}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSelected ? daw.color + '30' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {daw.logo}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: isSelected ? daw.color : 'rgba(255,255,255,0.7)' }}
                  >
                    {daw.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{
                        background: `${daw.color}15`,
                        color: daw.color,
                      }}
                    >
                      {t('daw.compatible')}
                    </span>
                    <span className="text-[9px] text-text-muted">
                      {daw.templateCount} {t('daw.templates')}
                    </span>
                  </div>
                </div>
                {isSelected && <ChevronRight size={12} style={{ color: daw.color }} className="flex-shrink-0" />}
              </motion.button>
            );
          })}
        </div>

        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExportAll}
            disabled={exportingAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#f59e0b',
              opacity: exportingAll ? 0.7 : 1,
            }}
          >
            {exportingAll ? (
              <><RefreshCw size={13} className="animate-spin" /> Exporting...</>
            ) : (
              <><Download size={13} /> Export All Templates</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Right: Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: `${selectedDaw.color}15`,
                border: `1px solid ${selectedDaw.color}30`,
              }}
            >
              {selectedDaw.logo}
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">{selectedDaw.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-muted">
                  v{selectedDaw.versions.join(' / ')}
                </span>
                <span className="text-[10px] text-text-muted">·</span>
                <span className="text-[10px]" style={{ color: selectedDaw.color }}>
                  {selectedDaw.exportFormat}
                </span>
                <span className="text-[10px] text-text-muted">·</span>
                <span className="text-[10px] text-text-muted">
                  {selectedDaw.templateCount} templates
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center flex-wrap gap-1.5">
            {selectedDaw.features.slice(0, 4).map((f) => (
              <span
                key={f}
                className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${selectedDaw.color}12`,
                  color: selectedDaw.color,
                  border: `1px solid ${selectedDaw.color}20`,
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div
          className="flex-shrink-0 flex items-center gap-1 px-6 py-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                activeTab === tab.id
                  ? {
                      background: `${selectedDaw.color}18`,
                      border: `1px solid ${selectedDaw.color}30`,
                      color: selectedDaw.color,
                    }
                  : { background: 'transparent', border: '1px solid transparent', color: '#6b7280' }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'export' && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <AnimatePresence>
                  {exportComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-2 p-3 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                    >
                      <CheckCircle size={14} style={{ color: '#10b981' }} />
                      <span className="text-xs text-emerald-400">Template exported successfully!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">{t('daw.exportPresets')}</h3>
                  <p className="text-xs text-text-muted mb-4">
                    Export your NEUROTEK AI templates in {selectedDaw.name}-compatible format ({selectedDaw.exportFormat})
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleExport('full')}
                      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                      style={{ background: `${selectedDaw.color}10`, border: `1px solid ${selectedDaw.color}25` }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${selectedDaw.color}20` }}
                      >
                        <FileText size={16} style={{ color: selectedDaw.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary mb-0.5">Full Template {selectedDaw.exportFormat}</p>
                        <p className="text-[10px] text-text-muted">Export all tracks, routing, FX chains and MIDI mappings</p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleExport('presets')}
                      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                      style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(124,58,237,0.15)' }}>
                        <Sliders size={16} style={{ color: '#a78bfa' }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary mb-0.5">FX Presets Only</p>
                        <p className="text-[10px] text-text-muted">Export just the FX chain presets for your current project</p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleExport('midi')}
                      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                      style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(6,182,212,0.15)' }}>
                        <Keyboard size={16} style={{ color: '#06b6d4' }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary mb-0.5">MIDI Mapping</p>
                        <p className="text-[10px] text-text-muted">Export controller mappings for {selectedDaw.name}</p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleExport('routing')}
                      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(16,185,129,0.15)' }}>
                        <PlugZap size={16} style={{ color: '#10b981' }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary mb-0.5">Track Routing</p>
                        <p className="text-[10px] text-text-muted">Export signal routing diagram and bus configuration</p>
                      </div>
                    </motion.button>
                  </div>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={13} style={{ color: '#f59e0b' }} />
                    <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                      {selectedDaw.name} Tips
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {selectedDaw.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-text-muted">
                        <ArrowRight size={10} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {activeTab === 'import' && (
              <motion.div
                key="import"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">{t('daw.importPresets')}</h3>
                  <p className="text-xs text-text-muted mb-4">
                    Import your {selectedDaw.name} project to analyse and integrate with NEUROTEK AI
                  </p>

                  <AnimatePresence>
                    {importSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-2 p-3 rounded-xl mb-4"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                      >
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                        <span className="text-xs text-emerald-400">Project imported! Tracks have been mapped to NEUROTEK AI.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.01 }}
                    className="rounded-xl p-10 text-center cursor-pointer transition-all"
                    style={{
                      background: importing ? `${selectedDaw.color}08` : 'rgba(255,255,255,0.02)',
                      border: `2px dashed ${importing ? selectedDaw.color + '50' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw size={28} className="animate-spin" style={{ color: selectedDaw.color }} />
                        <p className="text-sm text-text-muted">Importing project...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload size={28} style={{ color: selectedDaw.color }} />
                        <div>
                          <p className="text-sm font-medium text-text-primary">Drop {selectedDaw.exportFormat} file here</p>
                          <p className="text-[11px] text-text-muted mt-1">
                            or click to browse — supports {selectedDaw.name} {selectedDaw.versions.join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={selectedDaw.exportFormat + ',.json,.zip'}
                    onChange={handleImport}
                    className="hidden"
                  />
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={13} style={{ color: '#06b6d4' }} />
                    <span className="text-xs font-semibold" style={{ color: '#06b6d4' }}>What gets imported</span>
                  </div>
                  <ul className="space-y-1.5">
                    {['Track names and types', 'FX chain parameters', 'MIDI controller mappings', 'BPM and tempo information', 'Track routing and bus configuration'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[11px] text-text-muted">
                        <CheckCircle size={10} style={{ color: '#06b6d4' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {activeTab === 'midi' && (
              <motion.div
                key="midi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">{t('daw.midiMapping')}</h3>
                  <p className="text-xs text-text-muted mb-4">
                    Compatible MIDI controllers and mapping presets for {selectedDaw.name}
                  </p>

                  <div className="space-y-3">
                    {MIDI_CONTROLLERS.filter(
                      (ctrl) => ctrl.compatible.includes(selectedDaw.id) || ctrl.compatible.includes('all')
                    ).map((ctrl) => (
                      <div
                        key={ctrl.id}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${selectedDaw.color}15` }}
                          >
                            <Keyboard size={15} style={{ color: selectedDaw.color }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-text-primary">{ctrl.name}</p>
                            <p className="text-[10px] text-text-muted">
                              {ctrl.notes > 0 ? `${ctrl.notes} keys` : ''}
                              {ctrl.notes > 0 && ctrl.pads ? ' · ' : ''}
                              {ctrl.pads ? 'Pads' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(ctrl.compatible.includes(selectedDaw.id) || ctrl.compatible.includes('all')) && (
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                            >
                              COMPATIBLE
                            </span>
                          )}
                          <button
                            className="text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors"
                            style={{ background: `${selectedDaw.color}15`, color: selectedDaw.color, border: `1px solid ${selectedDaw.color}25` }}
                          >
                            Load Map
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-text-secondary mb-3">Mappable Parameters</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      'Master Volume', 'Master BPM', 'Track 1 Vol', 'Track 2 Vol',
                      'Track 3 Vol', 'FX Send 1', 'FX Send 2', 'Filter Cutoff',
                      'Resonance', 'Scene Launch', 'AI Generate', 'Tap Tempo',
                    ].map((param) => (
                      <div
                        key={param}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <span className="text-[11px] text-text-muted">{param}</span>
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: `${selectedDaw.color}15`, color: selectedDaw.color }}
                        >
                          CC—
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'guide' && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    {selectedDaw.name} Setup Guide
                  </h3>
                  <p className="text-xs text-text-muted mb-5">
                    Follow these steps to connect NEUROTEK AI with {selectedDaw.name}
                  </p>

                  <div className="space-y-3">
                    {selectedDaw.setupSteps.map((step, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className="flex items-start gap-4"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: `${selectedDaw.color}20`, color: selectedDaw.color }}
                        >
                          {idx + 1}
                        </div>
                        <div
                          className="flex-1 p-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <p className="text-xs text-text-secondary">{step}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{ background: `${selectedDaw.color}08`, border: `1px solid ${selectedDaw.color}18` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={13} style={{ color: selectedDaw.color }} />
                    <span className="text-xs font-semibold" style={{ color: selectedDaw.color }}>Supported Features</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDaw.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-[11px] text-text-muted">
                        <CheckCircle size={10} style={{ color: selectedDaw.color }} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <p className="text-[11px] text-text-muted">
                    Compatibility verified with {selectedDaw.name} {selectedDaw.versions.join(' and ')}.
                    Older versions may require manual adjustment.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

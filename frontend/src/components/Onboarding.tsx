// ============================================================
// NEUROTEK AI — Onboarding Flow (4 steps)
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Music2,
  Cpu,
  Bot,
  ChevronRight,
  Check,
  SkipForward,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OnboardingProps {
  onComplete: () => void;
}

interface UserPrefs {
  genre: string;
  bpm: number;
  daw: string;
}

const GENRES = [
  { id: 'tribe', label: 'Tribe', color: '#7c3aed', emoji: '🌀', bpmRange: '145-155' },
  { id: 'mentalcore', label: 'Mentalcore', color: '#ef4444', emoji: '⚡', bpmRange: '155-175' },
  { id: 'hardtek', label: 'Hardtek', color: '#f59e0b', emoji: '🔥', bpmRange: '140-155' },
  { id: 'tekno', label: 'Tekno', color: '#10b981', emoji: '🎛', bpmRange: '138-148' },
  { id: 'acidcore', label: 'Acidcore', color: '#06b6d4', emoji: '🧪', bpmRange: '145-160' },
  { id: 'hard-techno', label: 'Hard Techno', color: '#ec4899', emoji: '🏾d', bpmRange: '135-145' },
  { id: 'industrial', label: 'Industrial', color: '#6b7280', emoji: '⚙️', bpmRange: '150-165' },
  { id: 'neurofunk', label: 'Neurofunk', color: '#a78bfa', emoji: '🧠', bpmRange: '170-180' },
];

const DAWS_QUICK = [
  { id: 'ableton', label: 'Ableton Live', logo: '🎹', color: '#f59e0b' },
  { id: 'flstudio', label: 'FL Studio', logo: '🎛', color: '#06b6d4' },
  { id: 'reaper', label: 'Reaper', logo: '🔊', color: '#10b981' },
  { id: 'bitwig', label: 'Bitwig', logo: '⚡', color: '#7c3aed' },
  { id: 'logic', label: 'Logic Pro', logo: '🎵', color: '#06b6d4' },
  { id: 'cubase', label: 'Cubase', logo: '🎼', color: '#ec4899' },
  { id: 'other', label: 'Other', logo: '🎶', color: '#6b7280' },
];

const SUGGESTIONS = [
  'Help me design a kick for tribe music',
  'What BPM should I use for mentalcore?',
  'Explain sidechain compression for hardtek',
  'Generate a mentalcore template for me',
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [prefs, setPrefs] = useState<UserPrefs>({ genre: '', bpm: 145, daw: '' });

  const totalSteps = 4;

  function nextStep() {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function prevStep() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  function finish() {
    localStorage.setItem('nt_onboarding_complete', 'true');
    localStorage.setItem('nt_user_prefs', JSON.stringify(prefs));
    onComplete();
  }

  function skip() {
    finish();
  }

  const selectedGenre = GENRES.find((g) => g.id === prefs.genre);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5,5,10,0.97)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient background glows */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: selectedGenre ? `${selectedGenre.color}12` : 'rgba(124,58,237,0.08)',
          filter: 'blur(80px)',
          transition: 'background 0.5s ease',
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: selectedGenre ? `${selectedGenre.color}08` : 'rgba(6,182,212,0.06)',
          filter: 'blur(80px)',
          transition: 'background 0.5s ease',
        }}
      />

      <div className="relative z-10 w-full max-w-xl mx-4">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center gap-2 mb-3"
          >
            <svg width="36" height="36" viewBox="0 0 72 72" fill="none">
              <rect width="72" height="72" rx="14" fill="rgba(124,58,237,0.2)" stroke="rgba(124,58,237,0.5)" strokeWidth="1.5"/>
              <path d="M16 14v44M16 14l40 44M56 14v44" stroke="url(#og)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
            </svg>
            <span
              className="text-xl font-bold tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #a78bfa, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              NEUROTEK AI
            </span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xs text-text-muted"
          >
            {t('onboarding.subtitle')}
          </motion.p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              className="h-1 flex-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.3, delay: i <= step ? 0 : 0 }}
                style={{
                  background: selectedGenre ? selectedGenre.color : 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Step card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15,15,26,0.9)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            {/* STEP 0: Genre selection */}
            {step === 0 && (
              <motion.div
                key="step0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Music2 size={16} style={{ color: '#7c3aed' }} />
                  <h2 className="text-base font-bold text-text-primary">{t('onboarding.step1Title')}</h2>
                </div>
                <p className="text-xs text-text-muted mb-5">{t('onboarding.step1Desc')}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GENRES.map((genre) => {
                    const isSelected = prefs.genre === genre.id;
                    return (
                      <motion.button
                        key={genre.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPrefs((p) => ({ ...p, genre: genre.id, bpm: parseInt(genre.bpmRange.split('-')[0]) }))}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                        style={
                          isSelected
                            ? {
                                background: `${genre.color}20`,
                                border: `2px solid ${genre.color}50`,
                                boxShadow: `0 0 16px ${genre.color}20`,
                              }
                            : { background: 'rgba(255,255,255,0.03)', border: '2px solid transparent' }
                        }
                      >
                        <span className="text-2xl">{genre.emoji}</span>
                        <span
                          className="text-[11px] font-semibold leading-tight text-center"
                          style={{ color: isSelected ? genre.color : 'rgba(255,255,255,0.6)' }}
                        >
                          {genre.label}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono">{genre.bpmRange}</span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: genre.color }}
                          >
                            <Check size={9} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 1: BPM */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} style={{ color: '#f59e0b' }} />
                  <h2 className="text-base font-bold text-text-primary">{t('onboarding.step2Title')}</h2>
                </div>
                <p className="text-xs text-text-muted mb-6">{t('onboarding.step2Desc')}</p>

                {/* BPM display */}
                <div className="text-center mb-6">
                  <motion.div
                    key={prefs.bpm}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-end gap-2"
                  >
                    <span
                      className="text-6xl font-black font-mono leading-none"
                      style={{
                        background: selectedGenre
                          ? `linear-gradient(135deg, ${selectedGenre.color}, #a78bfa)`
                          : 'linear-gradient(135deg, #a78bfa, #06b6d4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {prefs.bpm}
                    </span>
                    <span className="text-lg text-text-muted mb-2 font-bold">BPM</span>
                  </motion.div>
                </div>

                {/* Slider */}
                <div className="mb-4">
                  <input
                    type="range"
                    min={100}
                    max={200}
                    value={prefs.bpm}
                    onChange={(e) => setPrefs((p) => ({ ...p, bpm: Number(e.target.value) }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, ${selectedGenre?.color ?? '#7c3aed'} ${((prefs.bpm - 100) / 100) * 100}%, rgba(255,255,255,0.1) 0%)`,
                    }}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-text-muted font-mono">100</span>
                    <span className="text-[10px] text-text-muted font-mono">200</span>
                  </div>
                </div>

                {/* Genre BPM guides */}
                <div className="grid grid-cols-2 gap-2">
                  {GENRES.slice(0, 6).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        const bpmVal = parseInt(g.bpmRange.split('-')[0]);
                        setPrefs((p) => ({ ...p, bpm: bpmVal, genre: g.id }));
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-lg transition-all"
                      style={{
                        background: prefs.genre === g.id ? `${g.color}15` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${prefs.genre === g.id ? g.color + '30' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      <span className="text-[11px]" style={{ color: prefs.genre === g.id ? g.color : '#6b7280' }}>
                        {g.label}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">{g.bpmRange}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: DAW selection */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cpu size={16} style={{ color: '#06b6d4' }} />
                  <h2 className="text-base font-bold text-text-primary">{t('onboarding.step3Title')}</h2>
                </div>
                <p className="text-xs text-text-muted mb-5">{t('onboarding.step3Desc')}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {DAWS_QUICK.map((daw) => {
                    const isSelected = prefs.daw === daw.id;
                    return (
                      <motion.button
                        key={daw.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPrefs((p) => ({ ...p, daw: daw.id }))}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                        style={
                          isSelected
                            ? {
                                background: `${daw.color}18`,
                                border: `2px solid ${daw.color}40`,
                                boxShadow: `0 0 16px ${daw.color}15`,
                              }
                            : { background: 'rgba(255,255,255,0.03)', border: '2px solid transparent' }
                        }
                      >
                        <span className="text-2xl">{daw.logo}</span>
                        <span
                          className="text-[11px] font-semibold leading-tight text-center"
                          style={{ color: isSelected ? daw.color : 'rgba(255,255,255,0.6)' }}
                        >
                          {daw.label}
                        </span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: daw.color }}
                          >
                            <Check size={9} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
                >
                  <Cpu size={12} style={{ color: '#06b6d4' }} />
                  <p className="text-[11px] text-text-muted">
                    DAW selection is optional — you can configure this later in the DAW Bridge section.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Ready */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Bot size={16} style={{ color: '#ec4899' }} />
                  <h2 className="text-base font-bold text-text-primary">{t('onboarding.step4Title')}</h2>
                </div>
                <p className="text-xs text-text-muted mb-5">{t('onboarding.step4Desc')}</p>

                {/* Summary card */}
                <div
                  className="p-4 rounded-xl mb-5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Your Setup</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-text-muted mb-0.5">Genre</p>
                      <p className="text-sm font-semibold" style={{ color: selectedGenre?.color ?? '#7c3aed' }}>
                        {selectedGenre ? selectedGenre.emoji + ' ' + selectedGenre.label : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted mb-0.5">BPM</p>
                      <p className="text-sm font-bold font-mono text-text-primary">{prefs.bpm}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted mb-0.5">DAW</p>
                      <p className="text-sm font-semibold text-text-primary">
                        {DAWS_QUICK.find((d) => d.id === prefs.daw)?.logo ?? '—'}{' '}
                        {prefs.daw ? DAWS_QUICK.find((d) => d.id === prefs.daw)?.label : 'None'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Chat intro */}
                <p className="text-[11px] text-text-muted mb-3">Try asking NEUROTEK AI:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors"
                      style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}
                    >
                      <Bot size={11} style={{ color: '#ec4899' }} className="flex-shrink-0" />
                      <span className="text-[11px] text-text-muted italic">{s}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation footer */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button
                  onClick={prevStep}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  {t('onboarding.back')}
                </button>
              ) : (
                <button
                  onClick={skip}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  <SkipForward size={12} />
                  {t('onboarding.skip')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Step dots */}
              <div className="flex items-center gap-1 mr-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === step ? 16 : 6,
                      height: 6,
                      background: i === step
                        ? selectedGenre?.color ?? '#7c3aed'
                        : i < step
                        ? 'rgba(255,255,255,0.3)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                  />
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selectedGenre
                    ? `linear-gradient(135deg, ${selectedGenre.color}, ${selectedGenre.color}cc)`
                    : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#fff',
                  boxShadow: `0 4px 16px ${selectedGenre?.color ?? '#7c3aed'}40`,
                }}
              >
                {step === totalSteps - 1 ? (
                  <>
                    {t('onboarding.finish')}
                    <Zap size={13} />
                  </>
                ) : (
                  <>
                    {t('onboarding.next')}
                    <ChevronRight size={13} />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

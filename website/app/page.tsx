'use client'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'

/* ── Animation helpers ───────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { show: { transition: { staggerChildren: 0.1 } } }
const fadeIn  = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5 } } }

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.section>
  )
}

/* ── Terminal mockup ─────────────────────────────────────────── */
function Terminal() {
  return (
    <div className="terminal w-full max-w-lg mx-auto lg:mx-0">
      <div className="terminal-bar">
        <span className="dot bg-[#ff5f57]" />
        <span className="dot bg-[#febc2e]" />
        <span className="dot bg-[#28c840]" />
        <span className="ml-3 text-nt-muted text-xs font-mono">neurotek-studio — AI Generate</span>
      </div>
      <div className="p-5 font-mono text-xs leading-6 space-y-1">
        <p><span className="text-nt-muted">$</span> <span className="text-nt-cyan">generate</span> <span className="text-[#a5b4fc]">&quot;dark hardtek drop, 145bpm minor&quot;</span></p>
        <p className="text-nt-muted pt-1">⠋ Analyzing genre patterns…</p>
        <p className="text-nt-muted">⠋ Building MIDI sequence…</p>
        <p className="pt-1 text-emerald-400">✓ 8-bar pattern generated in 0.7s</p>
        <div className="mt-3 space-y-1 text-xs">
          <p><span className="text-nt-muted">├─</span> <span className="text-nt-subtle">Kick    </span> <span className="text-[#a855f7]">█░░█░░░█ █░░░░█░░</span></p>
          <p><span className="text-nt-muted">├─</span> <span className="text-nt-subtle">Bass    </span> <span className="text-nt-cyan">Dm pentatonic · syncopated</span></p>
          <p><span className="text-nt-muted">├─</span> <span className="text-nt-subtle">Lead    </span> <span className="text-nt-subtle">8 notes · dorian mode</span></p>
          <p><span className="text-nt-muted">└─</span> <span className="text-nt-subtle">Chords  </span> <span className="text-nt-subtle">Dm7 → Am7 → Gm7</span></p>
        </div>
        <p className="pt-2 text-nt-muted">
          <span className="text-nt-subtle">Ready to export. </span>
          <span className="text-nt-cyan">Drop into piano roll?</span>
          <span className="animate-pulse"> ▋</span>
        </p>
      </div>
    </div>
  )
}

/* ── FAQ item ────────────────────────────────────────────────── */
const FAQS = [
  { q: 'Is Neurotek Studio really free?',                  a: 'Yes. The desktop app is free forever with 10 AI generations per month and 5 projects. No credit card required.' },
  { q: 'What platforms are supported?',                    a: 'Windows 10 / 11 (64-bit) is available now. macOS is in testing for beta.2, and Linux AppImage is planned for late 2025.' },
  { q: 'Does it work offline?',                            a: 'Fully. All DAW features — Piano Roll, Arrangement, Mixer, VST hosting — work with no internet connection. Only AI generation requires a connection.' },
  { q: 'Can I use my existing VST plugins?',               a: 'Yes. Neurotek Studio scans standard VST2 and VST3 paths automatically on startup and supports hosting them inside the app.' },
  { q: 'What AI model powers the generation?',             a: "Claude (Anthropic). Your prompts are sent over HTTPS to our backend. Audio and MIDI data never leave your machine unless you enable Cloud Sync." },
  { q: 'How is the Pro plan different from Free?',         a: 'Pro gives you 200 AI generations per month, unlimited projects, priority queue, and early access to new features.' },
  { q: 'Can I cancel my subscription at any time?',        a: 'Yes — cancel in one click. Your plan downgrades to Free at the end of the billing period. No lock-in.' },
  { q: 'Is the source code available?',                    a: 'Yes. Neurotek AI is open-source under the MIT license at github.com/mixpiloteai-oss/mixpiloteai.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-nt-border/60 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-sm font-medium text-nt-subtle group-hover:text-nt-text transition-colors">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full border border-nt-border flex items-center justify-center text-nt-muted transition-all duration-200 ${open ? 'rotate-45 border-nt-purple text-nt-violet' : ''}`}>
          +
        </span>
      </button>
      {open && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-nt-muted pb-5 leading-relaxed"
        >
          {a}
        </motion.p>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */
export default function Home() {
  return (
    <div className="flex flex-col">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-5 pt-28 pb-20 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #7c3aed, transparent 70%)' }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-4xl mx-auto"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span variants={fadeUp} className="section-label mb-6 inline-flex">
            v1.0-beta · Free Download · Windows
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] text-nt-text"
          >
            The AI Music<br />
            <span className="gradient-text">Production Studio</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 text-base sm:text-lg text-nt-muted max-w-2xl mx-auto leading-relaxed"
          >
            Generate beats, melodies, and full arrangements from a single prompt.
            Professional piano roll, mixer, VST hosting — all in one desktop app.
            Built for the underground tekno scene.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/download" className="btn-primary text-sm px-7 py-3">
              Download for Windows
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link href="/features" className="btn-ghost text-sm px-7 py-3">
              Explore Features
            </Link>
          </motion.div>

          <motion.p variants={fadeIn} className="mt-5 text-xs text-nt-muted/60">
            Free forever · No credit card · Windows 10 / 11
          </motion.p>
        </motion.div>

        {/* Hero terminal (desktop) */}
        <motion.div
          className="relative z-10 mt-16 w-full max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Terminal />
          {/* Glow under terminal */}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-20 blur-3xl rounded-full opacity-20 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        >
          <span className="text-[10px] uppercase tracking-widest text-nt-muted/40">Scroll</span>
          <motion.div
            className="w-px h-8 bg-gradient-to-b from-nt-muted/30 to-transparent"
            animate={{ scaleY: [1, 0.5, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        </motion.div>
      </section>

      {/* ── AI SHOWCASE ──────────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-5 py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.span variants={fadeUp} className="section-label">AI Assistant</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold tracking-tight text-nt-text leading-[1.1]">
              Describe it.<br /><span className="gradient-text">Hear it.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted leading-relaxed">
              Type a prompt — genre, energy, tempo — and the AI generates
              a full MIDI pattern in under a second. Drop it into the piano roll,
              edit, and keep going.
            </motion.p>
            <motion.ul variants={stagger} className="mt-8 space-y-4">
              {[
                ['Text-to-pattern',    'Describe a groove in plain English. AI produces the MIDI sequence.'],
                ['Chord suggestions',  'One-click chord progressions tuned to your key and genre.'],
                ['Genre presets',      'Hardtek, Tekno, Tribe, Mentalcore, Acid, Drum & Bass — AI-optimised.'],
              ].map(([t, d]) => (
                <motion.li key={t} variants={fadeUp} className="flex gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-nt-purple/15 border border-nt-purple/25 flex items-center justify-center shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-nt-text">{t}</p>
                    <p className="text-xs text-nt-muted mt-0.5">{d}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.div variants={fadeUp}>
            <Terminal />
          </motion.div>
        </div>
      </Section>

      {/* ── FEATURE GRID ─────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-section-fade pointer-events-none opacity-40" />
        <Section className="max-w-6xl mx-auto px-5 relative z-10 w-full">
          <div className="text-center mb-14">
            <motion.span variants={fadeUp} className="section-label">Full-Featured DAW</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold text-nt-text tracking-tight">
              Everything in one studio
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted max-w-xl mx-auto">
              A professional production environment — not a toy. Piano roll, mixer, arrangement, VST hosting, live performance.
            </motion.p>
          </div>

          <motion.div variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '♪', color: '#a855f7', title: 'Piano Roll',        desc: 'Full MIDI editor — velocity, quantize, zoom, multi-select, chord detection.' },
              { icon: '≡', color: '#06b6d4', title: 'Arrangement',        desc: 'Pattern-based sequencer with clip dragging, loop regions and scene launch.' },
              { icon: '⊟', color: '#a855f7', title: 'Mixer',             desc: 'Per-track faders, mute/solo, send/return routing and master bus with metering.' },
              { icon: '▶', color: '#06b6d4', title: 'Live Mode',          desc: 'Clip launcher for live performance, improvisation and DJ-style triggering.' },
              { icon: '⊕', color: '#a855f7', title: 'VST2 / VST3',       desc: 'Plugin scanner with automatic path detection. Host your existing plugins.' },
              { icon: '◈', color: '#06b6d4', title: 'Sample Browser',     desc: 'Local library with drag-to-track, waveform preview and tagging.' },
              { icon: '⊗', color: '#a855f7', title: 'Audio Routing',      desc: 'Configure sends, returns, sidechaining and complex signal flow.' },
              { icon: '☁', color: '#06b6d4', title: 'Cloud Sync',         desc: 'Sync projects across devices — Pro and Studio plans.' },
              { icon: '✦', color: '#a855f7', title: 'AI Generation',      desc: 'Text-to-pattern, chord suggestions, genre-aware MIDI creation.' },
            ].map(f => (
              <motion.div key={f.title} variants={fadeUp} className="card group cursor-default">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${f.color}15`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-nt-text text-sm mb-1.5">{f.title}</h3>
                <p className="text-nt-muted text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── LIVE PERFORMANCE ─────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-5 py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Visual — clip launcher mockup */}
          <motion.div variants={fadeUp} className="order-2 lg:order-1">
            <div className="rounded-2xl overflow-hidden border border-nt-border"
              style={{ background: '#06060d', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-nt-border" style={{ background: '#0c0c14' }}>
                <span className="dot w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="dot w-3 h-3 rounded-full bg-[#febc2e]" />
                <span className="dot w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-nt-muted text-xs font-mono">Live Mode — Session View</span>
              </div>
              <div className="p-5 grid grid-cols-4 gap-2">
                {Array.from({ length: 16 }).map((_, i) => {
                  const colors = ['#7c3aed', '#06b6d4', '#a855f7', '#7c3aed', '#06b6d4', '#a855f7']
                  const active = [0, 2, 5, 8, 9, 13].includes(i)
                  const color  = colors[i % colors.length]
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-lg flex items-center justify-center text-xs font-mono transition-all duration-200"
                      style={{
                        background: active ? `${color}25` : 'rgba(255,255,255,0.03)',
                        border:     `1px solid ${active ? color + '60' : 'rgba(255,255,255,0.06)'}`,
                        color:      active ? color : '#334155',
                        boxShadow:  active ? `0 0 12px ${color}30` : 'none',
                      }}
                    >
                      {active ? '▶' : '·'}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 px-5 py-3 border-t border-nt-border/50">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full w-3/5 rounded-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />
                </div>
                <span className="text-nt-muted text-xs font-mono">145 BPM</span>
              </div>
            </div>
          </motion.div>

          <div className="order-1 lg:order-2">
            <motion.span variants={fadeUp} className="section-label">Live Performance</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold tracking-tight text-nt-text leading-[1.1]">
              Built for the<br /><span className="gradient-text">stage.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted leading-relaxed">
              Launch clips, trigger patterns and build arrangements live.
              The clip launcher gives you full control in real time — keyboard,
              MIDI controller, or touchscreen.
            </motion.p>
            <motion.ul variants={stagger} className="mt-8 space-y-3">
              {[
                'Clip launcher with scene triggering',
                'MIDI controller mapping (beta.2)',
                'Low-latency ASIO / WASAPI audio',
                'Looper, mute groups, crossfade',
              ].map(item => (
                <motion.li key={item} variants={fadeUp} className="flex items-center gap-2.5 text-sm text-nt-muted">
                  <span className="text-nt-cyan">→</span> {item}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>
      </Section>

      {/* ── VST ECOSYSTEM ────────────────────────────────────── */}
      <section className="py-28 border-y border-nt-border/40" style={{ background: '#0c0c14' }}>
        <Section className="max-w-6xl mx-auto px-5 w-full">
          <div className="text-center mb-14">
            <motion.span variants={fadeUp} className="section-label">VST Ecosystem</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold text-nt-text tracking-tight">
              Your plugins. Your sound.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted max-w-xl mx-auto">
              Neurotek Studio scans and hosts VST2 and VST3 plugins automatically.
              Use everything you already own.
            </motion.p>
          </div>

          <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: '🎹', label: 'Synthesizers' },
              { icon: '🥁', label: 'Drum Machines' },
              { icon: '🎸', label: 'Samplers' },
              { icon: '🔊', label: 'Effects' },
              { icon: '🎛', label: 'Equalizers' },
              { icon: '🌊', label: 'Reverbs' },
            ].map(p => (
              <motion.div
                key={p.label}
                variants={fadeUp}
                className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-default transition-all duration-300 hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                whileHover={{ borderColor: 'rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.04)' }}
              >
                <span className="text-2xl">{p.icon}</span>
                <span className="text-xs text-nt-muted font-medium text-center">{p.label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.p variants={fadeUp} className="mt-8 text-center text-xs text-nt-muted/60">
            Compatible with VST2 · VST3 · Standard plugin formats on Windows, macOS (soon), Linux (soon)
          </motion.p>
        </Section>
      </section>

      {/* ── CLOUD SYNC ───────────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-5 py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.span variants={fadeUp} className="section-label">Cloud Sync</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold tracking-tight text-nt-text leading-[1.1]">
              Your studio,<br /><span className="gradient-text">everywhere.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted leading-relaxed">
              Projects sync automatically between devices. Version history keeps
              every save. One account, any machine.
            </motion.p>
            <motion.ul variants={stagger} className="mt-8 space-y-4">
              {[
                ['Auto-backup',      'Every save is versioned and synced in the background.'],
                ['Cross-device',     'Start on one machine, continue on another — instantly.'],
                ['Version history',  'Roll back to any previous save. Nothing is ever lost.'],
              ].map(([t, d]) => (
                <motion.li key={t} variants={fadeUp} className="flex gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-nt-cyan/10 border border-nt-cyan/25 flex items-center justify-center shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-nt-text">{t}</p>
                    <p className="text-xs text-nt-muted mt-0.5">{d}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
            <motion.p variants={fadeUp} className="mt-6 text-xs text-nt-muted/60">
              Available on Pro and Studio plans
            </motion.p>
          </div>

          {/* Cloud visual */}
          <motion.div variants={fadeUp} className="flex items-center justify-center">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 rounded-full opacity-20 blur-3xl animate-pulse-slow"
                style={{ background: 'radial-gradient(#06b6d4, transparent 70%)' }} />
              <div className="absolute inset-8 rounded-2xl glass flex flex-col items-center justify-center gap-3 border border-nt-cyan/15">
                <span className="text-4xl">☁</span>
                <div className="space-y-1.5 w-28">
                  {['Project v14', 'Project v13', 'Project v12'].map((v, i) => (
                    <div key={v} className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: `rgba(6,182,212,${0.5 - i * 0.15})` }} />
                      <span className="text-[10px] text-nt-muted font-mono">{v}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-nt-cyan/60 font-mono animate-pulse">syncing…</span>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── SCREENSHOTS PLACEHOLDER ──────────────────────────── */}
      <section className="py-16 overflow-hidden">
        <Section className="max-w-6xl mx-auto px-5 w-full">
          <div className="text-center mb-10">
            <motion.span variants={fadeUp} className="section-label">Screenshots</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl font-extrabold text-nt-text tracking-tight">
              See it in action
            </motion.h2>
          </div>
          <motion.div variants={stagger} className="grid md:grid-cols-3 gap-4">
            {['Piano Roll', 'Arrangement', 'AI Assistant'].map((label, i) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="aspect-video rounded-2xl flex flex-col items-center justify-center gap-3 border border-nt-border/60 relative overflow-hidden group"
                style={{ background: '#0c0c14' }}
                whileHover={{ borderColor: 'rgba(124,58,237,0.3)' }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.06), transparent)' }} />
                <span className="text-3xl opacity-30">{['♪', '≡', '✦'][i]}</span>
                <span className="text-sm font-medium text-nt-muted">{label}</span>
                <span className="text-xs text-nt-muted/40 px-3 py-1 rounded-full border border-nt-border/40">Coming in beta.2</span>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section className="py-28 border-t border-nt-border/40">
        <Section className="max-w-5xl mx-auto px-5 w-full">
          <div className="text-center mb-14">
            <motion.span variants={fadeUp} className="section-label">Pricing</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold text-nt-text tracking-tight">
              Start free. Scale when ready.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-nt-muted max-w-md mx-auto">
              No credit card required. Cancel any time.
            </motion.p>
          </div>

          <motion.div variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Free',
                price: '€0',
                period: 'forever',
                desc: 'Everything to get started.',
                features: ['10 AI generations / month', '5 projects', 'Piano Roll + Arrangement', 'Mixer', 'VST hosting', 'Offline mode'],
                cta: 'Download Free',
                href: '/download',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '€14.90',
                period: '/ month',
                desc: 'For serious producers.',
                features: ['200 AI generations / month', 'Unlimited projects', 'Everything in Free', 'Priority AI queue', 'Early access features', 'Cloud sync'],
                cta: 'Get Pro',
                href: '/login',
                highlight: true,
              },
              {
                name: 'Studio',
                price: '€39',
                period: '/ month',
                desc: 'For studios and power users.',
                features: ['Unlimited AI generations', 'Unlimited projects', 'Everything in Pro', 'Cloud sync + history', 'Dedicated support', 'Team collaboration (soon)'],
                cta: 'Get Studio',
                href: '/login',
                highlight: false,
              },
            ].map(p => (
              <motion.div
                key={p.name}
                variants={fadeUp}
                className={`rounded-2xl p-7 flex flex-col relative overflow-hidden ${p.highlight ? 'border border-nt-purple/50' : 'border border-nt-border'}`}
                style={{ background: p.highlight ? 'rgba(124,58,237,0.06)' : '#0f0f1a' }}
              >
                {p.highlight && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #a855f7, transparent)' }} />
                    <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-nt-violet border border-nt-purple/30 rounded-full px-2 py-0.5">
                      Popular
                    </span>
                  </>
                )}
                <p className="text-xs font-semibold uppercase tracking-widest text-nt-muted">{p.name}</p>
                <div className="mt-3 mb-1">
                  <span className="text-4xl font-extrabold text-nt-text">{p.price}</span>
                  <span className="text-nt-muted text-sm ml-1">{p.period}</span>
                </div>
                <p className="text-xs text-nt-muted mb-6">{p.desc}</p>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-nt-muted">
                      <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke={p.highlight ? '#a855f7' : '#06b6d4'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    p.highlight
                      ? 'btn-primary justify-center'
                      : 'btn-ghost justify-center'
                  }`}
                >
                  {p.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── DOWNLOAD CTA ─────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(124,58,237,0.12), transparent)' }} />
        <Section className="max-w-3xl mx-auto px-5 text-center w-full relative z-10">
          <motion.span variants={fadeUp} className="section-label">Download</motion.span>
          <motion.h2 variants={fadeUp} className="mt-5 text-4xl lg:text-5xl font-extrabold text-nt-text tracking-tight">
            Ready to produce?
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-nt-muted max-w-lg mx-auto">
            Download Neurotek Studio for free. No subscription required to start.
            Windows 10 / 11 · macOS coming soon.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link href="/download" className="btn-primary px-8 py-3.5 text-sm">
              🪟 Download for Windows
            </Link>
            <Link href="/pricing" className="btn-ghost px-8 py-3.5 text-sm">
              View plans
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-nt-muted/60">
            {['Free forever', 'No credit card', 'MIT open source', 'Windows 10 / 11'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/><path d="M3 5l1.5 1.5L7 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t}
              </span>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-28 border-t border-nt-border/40">
        <Section className="max-w-2xl mx-auto px-5 w-full">
          <div className="text-center mb-14">
            <motion.span variants={fadeUp} className="section-label">FAQ</motion.span>
            <motion.h2 variants={fadeUp} className="mt-5 text-4xl font-extrabold text-nt-text tracking-tight">
              Common questions
            </motion.h2>
          </div>
          <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-nt-border/60 px-6" style={{ background: '#0f0f1a' }}>
            {FAQS.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </motion.div>
        </Section>
      </section>

    </div>
  )
}

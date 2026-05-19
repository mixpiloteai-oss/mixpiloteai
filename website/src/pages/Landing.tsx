import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

/* ── Data ──────────────────────────────────────────────────────────── */

const DAW_TRACKS = [
  { label: 'Kick',  bars: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], color: '#a855f7' },
  { label: 'Snare', bars: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], color: '#06b6d4' },
  { label: 'Hi-H',  bars: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#22d3ee' },
  { label: 'Bass',  bars: [1,0,1,0,0,1,0,0,1,0,1,0,0,0,1,0], color: '#f59e0b' },
  { label: 'Lead',  bars: [0,0,1,0,1,0,0,1,0,0,1,1,0,0,0,1], color: '#a855f7' },
  { label: 'Pad',   bars: [1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1], color: '#10b981' },
]

// Waveform bar heights (random-ish but deterministic)
const WAVE_HEIGHTS = [4,8,14,20,26,18,10,24,30,22,16,28,12,20,8,26,
                      18,30,14,22,10,28,16,24,6,20,30,12,18,26,8,22]

const FEATURES = [
  {
    icon: '✦',
    title: 'AI Assistant',
    desc: 'Chat with your DAW. Describe the vibe, get a full arrangement — verse, chorus, bridge — in under 5 seconds.',
    accent: '#a855f7',
  },
  {
    icon: '⬡',
    title: 'Live Collab',
    desc: 'Real-time multi-user sessions with < 50 ms latency. See every cursor, every edit, every tweak — live.',
    accent: '#06b6d4',
  },
  {
    icon: '◈',
    title: 'Marketplace',
    desc: 'Browse 60,000+ loops, presets, and sample packs from top producers. One click to your project.',
    accent: '#f59e0b',
  },
  {
    icon: '⬢',
    title: 'Export Studio',
    desc: 'Render stems, full mixes, or MIDI in WAV 32-bit, FLAC, MP3 320. Mastering-chain included.',
    accent: '#10b981',
  },
  {
    icon: '◎',
    title: 'Plugin Browser',
    desc: 'Host VST3, AU, and LV2 plugins natively. Full automation, per-plugin undo, zero buffer overhead.',
    accent: '#22d3ee',
  },
  {
    icon: '⬟',
    title: 'Local AI',
    desc: 'On-device neural models run entirely offline. Your music stays private. No cloud required.',
    accent: '#a855f7',
  },
]

const HOW_STEPS = [
  {
    num: '01',
    title: 'Open a project',
    desc: 'Start blank or pick from 200+ templates. Your canvas loads in under a second.',
  },
  {
    num: '02',
    title: 'Ask the AI',
    desc: 'Type or speak: "Build a lo-fi hip-hop beat at 85 BPM with jazzy chords." Done.',
  },
  {
    num: '03',
    title: 'Export professionally',
    desc: 'Bounce stems, master the mix, distribute directly to Spotify, Apple Music, and more.',
  },
]

const COMPARE_ROWS = [
  { feature: 'AI-native composition',   nt: '✓ Built-in',   trad: '✗ Plugin add-on' },
  { feature: 'Real-time collaboration', nt: '✓ < 50 ms',    trad: '✗ File sharing only' },
  { feature: 'On-device AI (offline)',  nt: '✓ Always',     trad: '✗ Cloud-only' },
  { feature: 'Free tier',               nt: '✓ Forever',    trad: '✗ Trial only' },
  { feature: 'Cross-platform',          nt: '✓ Win/Mac/Linux', trad: '⚠ Usually Win/Mac' },
  { feature: 'Plugin format support',   nt: '✓ VST3/AU/LV2', trad: '⚠ VST3/AU' },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    tagline: 'Forever free. No catch.',
    featured: false,
    badge: null,
    features: [
      { text: '5 AI generations / month',   ok: true },
      { text: '2 active projects',          ok: true },
      { text: 'WAV & MP3 export',           ok: true },
      { text: 'Community support',          ok: true },
      { text: 'Unlimited projects',         ok: false },
      { text: 'Live collaboration',         ok: false },
    ],
    cta: 'Get Started Free',
    ctaStyle: 'ghost' as const,
    href: '/download',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/mo',
    tagline: 'For serious producers.',
    featured: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited AI generations',  ok: true },
      { text: 'Unlimited projects',        ok: true },
      { text: 'Stem & FLAC export',        ok: true },
      { text: 'Live collaboration (2 seats)', ok: true },
      { text: 'Plugin Browser',            ok: true },
      { text: 'Priority support',          ok: false },
    ],
    cta: 'Start Pro Trial',
    ctaStyle: 'primary' as const,
    href: '/pricing',
  },
  {
    name: 'Studio',
    price: '$49',
    period: '/mo',
    tagline: 'Teams & power users.',
    featured: false,
    badge: null,
    features: [
      { text: 'Everything in Pro',         ok: true },
      { text: 'Up to 10 collaborators',    ok: true },
      { text: 'Custom AI fine-tuning',     ok: true },
      { text: 'Mastering chain',           ok: true },
      { text: 'Dedicated success manager', ok: true },
      { text: 'SSO & audit logs',          ok: true },
    ],
    cta: 'Contact Sales',
    ctaStyle: 'ghost' as const,
    href: '/pricing',
  },
]

const LOGOS = ['Def Jam Studio', 'NeonWave', 'Orbital Lab', 'Phantom Sound', 'Studiohaus', 'Apex Beats']

/* ── Scroll-reveal hook ────────────────────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    el.querySelectorAll<HTMLElement>('.reveal').forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [])

  return ref
}

/* ── Component ─────────────────────────────────────────────────────── */

function Landing() {
  const [demoOpen, setDemoOpen] = useState(false)
  const pageRef = useScrollReveal()

  return (
    <div className="lp" ref={pageRef}>

      {/* ═══ HERO ═══════════════════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true">
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
          <div className="lp-grid" />
          <div className="lp-scanline" />
        </div>

        <div className="lp-hero-inner">
          {/* Left: copy */}
          <div className="lp-hero-content">
            <div className="lp-badge anim-float-up">
              <span className="lp-badge-dot" aria-hidden="true" />
              New — Studio 2.0 is live
            </div>

            <h1 className="lp-hero-title anim-float-up anim-float-up-1">
              The DAW that<br />
              <span className="grad">thinks.</span>
            </h1>

            <p className="lp-hero-sub anim-float-up anim-float-up-2">
              AI-native music production. Professional tools. Zero compromise.
            </p>

            <div className="lp-hero-actions anim-float-up anim-float-up-3">
              <Link to="/download" className="lp-btn-primary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1v8M4 7l4 4 4-4M1 13h14" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Free
              </Link>
              <button className="lp-btn-ghost" onClick={() => setDemoOpen(true)}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 5.5l4.5 2L6 9.5V5.5z" fill="currentColor" />
                </svg>
                Watch Demo
              </button>
            </div>

            <div className="lp-social-proof anim-float-up anim-float-up-4">
              <span className="lp-stars" aria-label="5 stars">★★★★★</span>
              <span>4.9 · 12,400 producers</span>
            </div>
          </div>

          {/* Right: DAW mockup */}
          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-daw">
              <div className="lp-daw-titlebar">
                <div className="lp-daw-dots">
                  <span style={{ background: '#ff5f57' }} />
                  <span style={{ background: '#febc2e' }} />
                  <span style={{ background: '#28c840' }} />
                </div>
                <span className="lp-daw-name">NeuroTek AI — Untitled Project</span>
                <div className="lp-daw-meta">
                  <span className="lp-bpm">140 BPM</span>
                  <span>4/4</span>
                </div>
              </div>

              <div className="lp-daw-body">
                <div className="lp-daw-tracks">
                  {DAW_TRACKS.map((track) => (
                    <div key={track.label} className="lp-daw-track">
                      <span className="lp-daw-track-label">{track.label}</span>
                      <div className="lp-daw-bars">
                        {track.bars.map((on, i) => (
                          <div
                            key={i}
                            className={`lp-daw-bar${on ? ' on' : ''}`}
                            style={{ '--bar-c': track.color } as React.CSSProperties}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Waveform */}
                <div className="lp-daw-waveform" aria-hidden="true">
                  {WAVE_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className="lp-daw-waveform-bar"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>

                <div className="lp-daw-footer">
                  <div className="lp-daw-status">
                    <span className="lp-daw-led" />
                    <span className="lp-daw-status-text">AI Engine · Ready</span>
                  </div>
                  <div className="lp-daw-tags">
                    {['Trap', 'Lo-Fi', 'House'].map((t) => (
                      <span key={t} className="lp-daw-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LOGOS STRIP ════════════════════════════════════════════════ */}
      <section className="lp-logos">
        <div className="lp-logos-inner">
          <p className="lp-logos-label">Trusted by producers at</p>
          <div className="lp-logos-row">
            {LOGOS.map((name) => (
              <span key={name} className="lp-logo-item">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS ══════════════════════════════════════════════════════ */}
      <section className="lp-stats">
        <div className="lp-stats-inner">
          {[
            { val: '12,400+',  label: 'Producers',       delay: '0s' },
            { val: '2.4M',     label: 'Projects Created', delay: '0.1s' },
            { val: '98%',      label: 'Uptime SLA',       delay: '0.2s' },
            { val: '< 50 ms',  label: 'AI Latency',       delay: '0.3s' },
          ].map(({ val, label, delay }) => (
            <div
              key={label}
              className="lp-stat reveal"
              style={{ animationDelay: delay }}
            >
              <span className="lp-stat-value">{val}</span>
              <span className="lp-stat-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══════════════════════════════════════════════════ */}
      <section className="lp-features" id="features">
        <div className="lp-section-head reveal">
          <p className="lp-section-eyebrow">Features</p>
          <h2 className="lp-section-title">
            Everything you need to{' '}
            <span className="grad">produce music</span>
          </h2>
          <p className="lp-section-desc">
            From AI-generated beats to professional export — one tool, zero compromise.
          </p>
        </div>

        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="lp-feature-card reveal"
              style={{ transitionDelay: `${i * 0.07}s` }}
            >
              <div
                className="lp-feature-icon-wrap"
                style={{
                  background: `${f.accent}18`,
                  borderColor: `${f.accent}30`,
                  color: f.accent,
                }}
              >
                {f.icon}
              </div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════ */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-section-head reveal">
          <p className="lp-section-eyebrow">How it works</p>
          <h2 className="lp-section-title">
            From idea to track{' '}
            <span className="grad">in three steps</span>
          </h2>
        </div>

        <div className="lp-how-steps">
          {HOW_STEPS.map((step, i) => (
            <>
              <div
                key={step.num}
                className="lp-how-step reveal"
                style={{ transitionDelay: `${i * 0.15}s` }}
              >
                <div className="lp-how-num">{step.num}</div>
                <h3 className="lp-how-step-title">{step.title}</h3>
                <p className="lp-how-step-desc">{step.desc}</p>
              </div>
              {i < HOW_STEPS.length - 1 && (
                <div className="lp-how-arrow" aria-hidden="true" key={`arrow-${i}`}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11h14M11 4l7 7-7 7" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </>
          ))}
        </div>
      </section>

      {/* ═══ COMPARISON ═════════════════════════════════════════════════ */}
      <section className="lp-compare">
        <div className="lp-compare-inner">
          <div className="lp-section-head reveal" style={{ maxWidth: '100%', marginBottom: 48 }}>
            <p className="lp-section-eyebrow">Why switch</p>
            <h2 className="lp-section-title">
              NeuroTek vs{' '}
              <span className="grad">traditional DAWs</span>
            </h2>
          </div>

          <table className="lp-compare-table reveal">
            <thead>
              <tr>
                <th>Capability</th>
                <th className="col-nt">NeuroTek AI</th>
                <th>Traditional DAW</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td className="yes">{row.nt}</td>
                  <td className="no">{row.trad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ PRICING TEASER ═════════════════════════════════════════════ */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-section-head reveal">
          <p className="lp-section-eyebrow">Pricing</p>
          <h2 className="lp-section-title">
            Simple, transparent{' '}
            <span className="grad">pricing</span>
          </h2>
          <p className="lp-section-desc">
            Start free. Scale when you're ready. No hidden fees, ever.
          </p>
        </div>

        <div className="lp-pricing-grid">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`lp-plan-card reveal${plan.featured ? ' featured' : ''}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              {plan.badge && <div className="lp-plan-badge">{plan.badge}</div>}
              <p className="lp-plan-name">{plan.name}</p>
              <div className="lp-plan-price">
                <span className="lp-plan-price-num">{plan.price}</span>
                <span className="lp-plan-price-period">{plan.period}</span>
              </div>
              <p className="lp-plan-tagline">{plan.tagline}</p>
              <div className="lp-plan-divider" />
              <ul className="lp-plan-features">
                {plan.features.map((feat) => (
                  <li key={feat.text} className="lp-plan-feature">
                    <span className={`lp-plan-check${feat.ok ? '' : ' dim'}`}>
                      {feat.ok ? '✓' : '✗'}
                    </span>
                    {feat.text}
                  </li>
                ))}
              </ul>
              <Link to={plan.href} className={`lp-plan-cta ${plan.ctaStyle}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA ══════════════════════════════════════════════════ */}
      <section className="lp-cta">
        <div className="lp-cta-bg" aria-hidden="true">
          <div className="lp-cta-orb-1" />
          <div className="lp-cta-orb-2" />
        </div>
        <div className="lp-cta-inner reveal">
          <h2 className="lp-cta-title">
            Start making music{' '}
            <span className="grad">differently.</span>
          </h2>
          <p className="lp-cta-sub">
            Download NeuroTek AI and produce your first track in minutes.
            Free forever — no credit card required.
          </p>
          <div className="lp-cta-actions">
            <Link to="/download" className="lp-btn-primary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1v8M4 7l4 4 4-4M1 13h14" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download Free
            </Link>
            <Link to="/pricing" className="lp-btn-ghost">
              See all plans
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ DEMO MODAL ══════════════════════════════════════════════════ */}
      {demoOpen && (
        <div
          className="modal-overlay"
          onClick={() => setDemoOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Demo video"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setDemoOpen(false)}
              aria-label="Close demo"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="modal-video-placeholder">
              <div className="modal-play-icon">
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="26" r="25" stroke="var(--purple)" strokeWidth="2" />
                  <path d="M20 16l20 10-20 10V16z" fill="var(--purple)" />
                </svg>
              </div>
              <p>Demo video coming soon.</p>
              <p className="text-muted" style={{ fontSize: 14, marginTop: 8 }}>
                Join Discord for early-access previews.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Landing

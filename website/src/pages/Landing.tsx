import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

interface Feature {
  icon: string
  title: string
  description: string
}

const features: Feature[] = [
  { icon: '🥁', title: 'AI Beat Generation', description: 'Generate professional drum patterns in seconds across 8 genres with our neural rhythm engine.' },
  { icon: '🎼', title: 'Intelligent Arrangement', description: 'AI lays out full 64-bar arrangements automatically, complete with verse, chorus, and bridge structures.' },
  { icon: '🎹', title: 'Piano Roll Editor', description: 'Professional MIDI editing with snap, quantize, velocity curves, and unlimited undo history.' },
  { icon: '🔊', title: 'Sample Browser', description: '500MB local cache for instant access to your sounds, with AI-powered search and tagging.' },
  { icon: '🎤', title: 'Live Performance Mode', description: 'Scene launching and clip triggering for live sets. Take your AI-generated music to the stage.' },
  { icon: '🔌', title: 'VST Plugin Host', description: 'Load your favorite VST/VST3 plugins directly in the app. Full parameter automation support.' },
]

const testimonials = [
  { quote: "NeuroTek AI completely changed how I produce music. What used to take me 3 hours — building a full arrangement — now takes 10 minutes. The AI understands musical structure like nothing I've ever seen.", author: 'Marcus Reid', role: 'Electronic Music Producer, Los Angeles', avatar: 'MR' },
  { quote: "I was skeptical about AI music tools, but NeuroTek is different. It doesn't replace my creativity — it amplifies it. The beat generation is eerily good for hip-hop and the sample browser is blazing fast.", author: 'Priya Nair', role: 'Hip-Hop Producer & Songwriter', avatar: 'PN' },
  { quote: 'As someone who produces ambient and electronic music, the intelligent arrangement feature is a game changer. It respects the emotional arc of a track in a way that feels genuinely musical.', author: 'Theo Vandenberg', role: 'Ambient / Experimental Producer', avatar: 'TV' },
]

const stats = [
  { value: '10,000+', label: 'Active Producers' },
  { value: '2M+', label: 'Tracks Generated' },
  { value: '4.9 / 5', label: 'Average Rating' },
  { value: '8', label: 'Genres Supported' },
]

function Landing() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-grid" />
        </div>
        <div className="container">
          <div className="hero-content">
            <div className="badge hero-badge animate-fade-in"><span className="badge-dot" />v1.0.0-beta — Now Available</div>
            <h1 className="hero-title animate-slide-up">Create Professional <span className="gradient-text">Music With AI</span></h1>
            <p className="hero-subtitle animate-slide-up">NeuroTek AI is the world's most advanced AI-powered music production studio. Generate beats, melodies, and full arrangements with one click. Free to download, forever.</p>
            <div className="hero-actions animate-fade-in">
              <Link to="/download" className="btn-primary hero-btn-main">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v10M5 8l4 4 4-4M1 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Download for Windows — Free
              </Link>
              <button className="btn-secondary" onClick={() => setDemoOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor" /></svg>
                Watch Demo
              </button>
            </div>
            <p className="hero-subtext">Windows 10/11 &bull; 120 MB download &bull; No credit card required</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-app-preview">
              <div className="app-preview-header">
                <div className="app-preview-dots"><span style={{ background: '#ff5f57' }} /><span style={{ background: '#febc2e' }} /><span style={{ background: '#28c840' }} /></div>
                <span className="app-preview-title">NeuroTek AI — Untitled Project</span>
              </div>
              <div className="app-preview-body">
                <div className="app-preview-tracks">
                  {[
                    { label: 'Kick', bars: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], color: '#a78bfa' },
                    { label: 'Snare', bars: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], color: '#06b6d4' },
                    { label: 'Hi-Hat', bars: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#34d399' },
                    { label: 'Bass', bars: [1,0,1,0,0,1,0,0,1,0,1,0,0,0,1,0], color: '#f59e0b' },
                    { label: 'Lead', bars: [0,0,1,0,1,0,0,1,0,0,1,1,0,0,0,1], color: '#a78bfa' },
                    { label: 'Pad', bars: [1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1], color: '#06b6d4' },
                  ].map((track) => (
                    <div key={track.label} className="preview-track">
                      <span className="preview-track-label">{track.label}</span>
                      <div className="preview-track-bars">
                        {track.bars.map((active, i) => (
                          <div key={i} className={`preview-bar${active ? ' active' : ''}`} style={{ '--bar-color': track.color } as React.CSSProperties} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="app-preview-ai">
                  <div className="ai-status"><span className="ai-dot" /><span className="ai-label">AI Engine</span><span className="ai-status-text">Ready</span></div>
                  <div className="ai-genre-tags"><span>Trap</span><span>Lo-Fi</span><span>House</span><span>DNB</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat) => (
              <div key={stat.value} className="stat-item">
                <span className="stat-value gradient-text">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section features-section" id="features">
        <div className="container">
          <div className="features-header">
            <div className="section-label">Features</div>
            <h2 className="section-title">Everything you need to <span className="gradient-text">produce music</span></h2>
            <p className="section-subtitle">From AI-generated beats to professional mixing, NeuroTek AI packs everything a modern producer needs into one streamlined app.</p>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <div key={feature.title} className="glass-card feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section how-section">
        <div className="container">
          <div className="how-header">
            <div className="section-label">How It Works</div>
            <h2 className="section-title">From idea to track <span className="gradient-text">in three steps</span></h2>
          </div>
          <div className="how-steps">
            <div className="how-step"><div className="how-step-number">01</div><div className="how-step-content"><h3>Choose your genre & mood</h3><p>Select from 8 genres and fine-tune the energy, tempo, and complexity with simple sliders.</p></div></div>
            <div className="how-step-arrow" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div className="how-step"><div className="how-step-number">02</div><div className="how-step-content"><h3>Generate with AI</h3><p>Hit generate and watch NeuroTek AI create a complete arrangement in under 5 seconds.</p></div></div>
            <div className="how-step-arrow" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div className="how-step"><div className="how-step-number">03</div><div className="how-step-content"><h3>Edit, export & share</h3><p>Refine in the Piano Roll, add your own samples or VSTs, then export to WAV, MP3, or MIDI.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section testimonials-section">
        <div className="container">
          <div className="testimonials-header">
            <div className="section-label">Social Proof</div>
            <h2 className="section-title">Trusted by <span className="gradient-text">10,000+ producers</span></h2>
            <p className="section-subtitle">From bedroom producers to touring artists, NeuroTek AI is the tool of choice for music creators around the world.</p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t) => (
              <div key={t.author} className="glass-card testimonial-card">
                <div className="testimonial-stars" aria-label="5 stars">{'★★★★★'}</div>
                <blockquote className="testimonial-quote">"{t.quote}"</blockquote>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" aria-hidden="true">{t.avatar}</div>
                  <div><div className="testimonial-name">{t.author}</div><div className="testimonial-role">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-bg" aria-hidden="true"><div className="cta-orb-1" /><div className="cta-orb-2" /></div>
        <div className="container">
          <div className="cta-content">
            <div className="badge badge-cyan" style={{ marginBottom: '24px' }}><span className="badge-dot" />Free Forever Plan Available</div>
            <h2 className="cta-title">Start creating for <span className="gradient-text">free today</span></h2>
            <p className="cta-subtitle">Download NeuroTek AI and start making professional music in minutes. No credit card required.</p>
            <div className="cta-actions">
              <Link to="/download" className="btn-primary cta-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v10M5 8l4 4 4-4M1 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Download for Windows — Free
              </Link>
              <Link to="/pricing" className="btn-secondary">View Pricing Plans</Link>
            </div>
            <p className="cta-fine">Windows 10/11 64-bit &bull; ~120 MB &bull; v1.0.0-beta.1</p>
          </div>
        </div>
      </section>

      {demoOpen && (
        <div className="modal-overlay" onClick={() => setDemoOpen(false)} role="dialog" aria-modal="true" aria-label="Demo video">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDemoOpen(false)} aria-label="Close demo">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <div className="modal-video-placeholder">
              <div className="modal-play-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" stroke="var(--purple)" strokeWidth="2" /><path d="M19 15l18 9-18 9V15z" fill="var(--purple)" /></svg></div>
              <p>Demo video coming soon.</p>
              <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>Follow us on Discord for early access previews.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Landing

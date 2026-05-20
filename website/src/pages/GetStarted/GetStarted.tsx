import { Link } from 'react-router-dom'
import './GetStarted.css'

/* ── Step data ─────────────────────────────────────────────────────── */

const STEPS = [
  {
    num: 1,
    icon: '⚡',
    title: 'Installe l\'application',
    desc: 'Télécharge Neurotek AI pour Mac, Windows ou Linux. Installation en 2 minutes.',
    visual: (
      <div className="gs-step-visual">
        <div className="gs-platform-chips">
          <span className="gs-platform-chip">🍎 Mac</span>
          <span className="gs-platform-chip">🪟 Windows</span>
          <span className="gs-platform-chip">🐧 Linux</span>
        </div>
      </div>
    ),
  },
  {
    num: 2,
    icon: '🎛️',
    title: 'L\'interface DAW',
    desc: 'Découvre l\'arrangement, le mixer, le piano roll et l\'assistant IA. Tout est accessible depuis la barre latérale.',
    visual: (
      <div className="gs-step-visual">
        <div className="gs-daw-zones">
          <div className="gs-daw-zone primary">Timeline</div>
          <div className="gs-daw-zone primary">Mixer</div>
          <div className="gs-daw-zone">Piano Roll</div>
          <div className="gs-daw-zone">Browser</div>
        </div>
      </div>
    ),
  },
  {
    num: 3,
    icon: '🎵',
    title: 'Crée ton premier projet',
    desc: 'Choisis un template adapté à ton style : Mentalcore, Hardtek, Ambient ou démarre vide. L\'assistant IA guide chaque étape.',
    visual: (
      <div className="gs-step-visual">
        <div className="gs-mini-templates">
          <div className="gs-mini-template">
            <div className="gs-mini-template-name">🔥 Mentalcore</div>
            <div className="gs-mini-template-bpm">170 BPM</div>
          </div>
          <div className="gs-mini-template">
            <div className="gs-mini-template-name">⚡ Hardtek</div>
            <div className="gs-mini-template-bpm">160 BPM</div>
          </div>
          <div className="gs-mini-template">
            <div className="gs-mini-template-name">🌌 Ambient</div>
            <div className="gs-mini-template-bpm">90 BPM</div>
          </div>
          <div className="gs-mini-template">
            <div className="gs-mini-template-name">📄 Vide</div>
            <div className="gs-mini-template-bpm">∞</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: 4,
    icon: '🚀',
    title: 'Fonctionnalités avancées',
    desc: 'Piano roll complet, effets, routing avancé, collaboration en temps réel, marketplace de plugins.',
    visual: (
      <div className="gs-step-visual">
        <div className="gs-feature-chips">
          <span className="gs-feature-chip">Piano Roll</span>
          <span className="gs-feature-chip">Effets</span>
          <span className="gs-feature-chip">Routing</span>
          <span className="gs-feature-chip">Collaboration</span>
          <span className="gs-feature-chip">Marketplace</span>
          <span className="gs-feature-chip">Export</span>
        </div>
      </div>
    ),
  },
]

/* ── Template data ─────────────────────────────────────────────────── */

const TEMPLATES = [
  {
    icon: '🔥',
    name: 'Mentalcore Starter',
    bpm: '170 BPM',
    desc: 'Kicks intenses, bassline hypnotique, atmosphères psychédéliques',
    tags: ['psytrance', 'techno', 'intense'],
  },
  {
    icon: '⚡',
    name: 'Hardtek Foundation',
    bpm: '160 BPM',
    desc: 'Structure hardtek classique, kicks tribaux, énergie maximale',
    tags: ['hard', 'tribal', 'rave'],
  },
  {
    icon: '🌌',
    name: 'Ambient Voyage',
    bpm: '90 BPM',
    desc: 'Pads éthérés, textures atmosphériques, voyage sonore',
    tags: ['ambient', 'chill', 'pads'],
  },
  {
    icon: '📄',
    name: 'Projet Vide',
    bpm: '∞',
    desc: 'Commence de zéro. Canvas blanc pour ta créativité.',
    tags: ['blank', 'custom', 'libre'],
  },
]

/* ── FAQ data ──────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Neurotek AI est-il gratuit ?',
    a: 'Oui, la version free est entièrement fonctionnelle. Les plans Pro et Studio débloquent des fonctionnalités avancées comme la collaboration illimitée et l\'IA avancée.',
  },
  {
    q: 'Sur quelles plateformes fonctionne l\'application ?',
    a: 'Neurotek AI fonctionne sur Mac (Intel & Apple Silicon), Windows 10/11, et Linux (Ubuntu 20.04+).',
  },
  {
    q: 'Ai-je besoin d\'une connexion internet ?',
    a: 'Non. Neurotek AI fonctionne entièrement hors-ligne. La connexion internet est nécessaire uniquement pour la collaboration en temps réel et le marketplace.',
  },
  {
    q: 'L\'assistant IA fonctionne-t-il localement ?',
    a: 'Oui ! Neurotek AI supporte les modèles IA locaux (Ollama, LM Studio) pour une utilisation 100% privée et sans abonnement IA.',
  },
  {
    q: 'Comment migrer mes projets existants ?',
    a: 'Neurotek AI importe les formats audio standards (WAV, MP3, FLAC) et les projets peuvent être organisés via le navigateur intégré.',
  },
  {
    q: 'Est-ce que je peux collaborer avec d\'autres producteurs ?',
    a: 'Oui, la collaboration temps réel est intégrée. Invitez des collaborateurs directement depuis l\'application, avec curseurs partagés et synchronisation automatique.',
  },
]

/* ── Component ─────────────────────────────────────────────────────── */

function GetStarted() {
  return (
    <div className="gs-page">

      {/* ═══ HERO ═══════════════════════════════════════════════════════ */}
      <section className="gs-hero">
        <div className="gs-container">
          <h1 className="gs-hero-title">
            Commence avec <span>Neurotek AI</span>
          </h1>
          <p className="gs-hero-sub">
            De débutant à producteur — guide interactif pas à pas
          </p>
          <Link to="/download" className="nt-btn nt-btn-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1v8M4 7l4 4 4-4M1 13h14" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Télécharger gratuitement
          </Link>
        </div>
      </section>

      {/* ═══ STEPS ══════════════════════════════════════════════════════ */}
      <section className="gs-steps">
        <div className="gs-container">
          <h2 className="gs-section-title">Guide pas à pas</h2>
          <p className="gs-section-sub">Tout ce qu'il faut pour démarrer en quelques minutes</p>
          <div className="gs-steps-grid">
            {STEPS.map((step) => (
              <div key={step.num} className="gs-step-card">
                <div className="gs-step-num">{step.num}</div>
                <div className="gs-step-icon">{step.icon}</div>
                <h3 className="gs-step-title">{step.title}</h3>
                <p className="gs-step-desc">{step.desc}</p>
                {step.visual}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TEMPLATES ══════════════════════════════════════════════════ */}
      <section className="gs-templates">
        <div className="gs-container">
          <h2 className="gs-section-title">Templates pour débutants</h2>
          <p className="gs-section-sub">Choisis un point de départ adapté à ton style musical</p>
          <div className="gs-template-grid">
            {TEMPLATES.map((tpl) => (
              <div key={tpl.name} className="gs-template-card">
                <div className="gs-template-card-header">
                  <span className="gs-template-card-icon">{tpl.icon}</span>
                  <div>
                    <div className="gs-template-card-name">{tpl.name}</div>
                    <span className="gs-template-card-bpm">{tpl.bpm}</span>
                  </div>
                </div>
                <p className="gs-template-card-desc">{tpl.desc}</p>
                <div className="gs-template-card-tags">
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="gs-template-card-tag">{tag}</span>
                  ))}
                </div>
                <a href="#download" className="nt-btn nt-btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
                  Ouvrir dans l'app
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ════════════════════════════════════════════════════════ */}
      <section className="gs-faq">
        <div className="gs-container">
          <h2 className="gs-section-title">Questions fréquentes</h2>
          <p className="gs-section-sub">Tout ce que tu dois savoir avant de commencer</p>
          <div className="gs-faq-list">
            {FAQS.map((item) => (
              <details key={item.q} className="gs-faq-item">
                <summary>{item.q}</summary>
                <p className="gs-faq-answer">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ══════════════════════════════════════════════════ */}
      <section className="gs-cta">
        <div className="gs-container">
          <h2 className="gs-cta-title">Prêt à créer ?</h2>
          <p className="gs-cta-sub">Rejoins des milliers de producteurs qui utilisent Neurotek AI</p>
          <div className="gs-cta-btns">
            <Link to="/download" className="nt-btn nt-btn-primary">
              Télécharger gratuitement
            </Link>
            <Link to="/pricing" className="nt-btn nt-btn-secondary">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default GetStarted

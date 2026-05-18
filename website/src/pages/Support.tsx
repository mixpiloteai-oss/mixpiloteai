import { useState } from 'react'
import './Support.css'

const faqs = [
  { question: 'How do I install NeuroTek AI?', answer: 'Download the installer from our Download page (NeuroTekAI-Setup-1.0.0-beta.1.exe). Run the file — if Windows SmartScreen prompts you, click "More info" then "Run anyway". The installer will walk you through setup in about 30 seconds.' },
  { question: 'Is the free version really free?', answer: 'Yes — no credit card, no trial period, no catch. The free tier gives you 10 AI generations per month, the full Piano Roll editor, arrangement timeline, 5 project slots, and WAV/MIDI export. You can use NeuroTek AI free forever.' },
  { question: 'How do I report a bug?', answer: 'Use the in-app feedback tool (Help → Report Bug) which automatically attaches your log files. You can also open an issue on our GitHub page or post in #bug-reports on Discord. Please include your Windows version and steps to reproduce.' },
  { question: 'Does NeuroTek AI work without internet?', answer: 'Partially. Core DAW features — Piano Roll, Arrangement view, Sample Browser (with cached samples) — work fully offline. AI generation features require an internet connection. We are working on an optional on-device AI mode.' },
  { question: 'Will you support Mac and Linux?', answer: "Yes, both are planned. macOS (Apple Silicon and Intel) is our next priority and is currently in internal testing. Linux (AppImage / .deb) is planned for later in 2025." },
  { question: 'How do I export my music?', answer: 'Go to File → Export (or press Ctrl+E). You can export the entire project as stereo WAV or MP3, or export individual tracks as stems. MIDI export is also available. Pro and Studio users have access to MP3 export with configurable bitrate.' },
]

function Support() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="support-page">
      <div className="support-hero">
        <div className="support-hero-bg" aria-hidden="true"><div className="support-orb-1" /><div className="support-orb-2" /></div>
        <div className="container">
          <div className="section-label">Help &amp; Support</div>
          <h1 className="support-title">We've got you <span className="gradient-text">covered</span></h1>
          <p className="support-subtitle">Find answers in our FAQ, join the community on Discord, or reach out directly. We typically respond within 24 hours.</p>
          <div className="support-quick-links">
            <a href="#faq" className="support-quick-link"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 8c0-1.105.895-2 2-2s2 .895 2 2c0 1.5-2 2-2 3M10 14v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>FAQ</a>
            <a href="#community" className="support-quick-link"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 10c0 4.418-3.582 8-8 8-1.25 0-2.435-.287-3.488-.8L2 19l1.8-4.512A7.964 7.964 0 012 10C2 5.582 5.582 2 10 2s8 3.582 8 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Community</a>
            <a href="#contact" className="support-quick-link"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>Contact</a>
            <a href="#" className="support-quick-link"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4h12v13H4V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>Documentation</a>
          </div>
        </div>
      </div>

      <section className="section support-faq-section" id="faq">
        <div className="container">
          <div className="support-faq-layout">
            <div className="support-faq-header">
              <div className="section-label">FAQ</div>
              <h2 className="section-title">Common <span className="gradient-text">questions</span></h2>
              <p className="section-subtitle">Can't find what you're looking for? Ask in our Discord or email us directly.</p>
            </div>
            <div className="support-faq-list">
              {faqs.map((item, i) => (
                <div key={i} className={`support-faq-item${openFaq === i ? ' open' : ''}`}>
                  <button className="support-faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                    <div className="support-faq-q-left">
                      <span className="support-faq-num">{String(i + 1).padStart(2, '0')}</span>
                      <span>{item.question}</span>
                    </div>
                    <svg className="support-faq-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <div className="support-faq-answer"><div className="support-faq-answer-inner"><p>{item.answer}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section support-community-section" id="community">
        <div className="container">
          <div className="section-label">Community</div>
          <h2 className="section-title">Join the <span className="gradient-text">community</span></h2>
          <p className="section-subtitle" style={{ marginBottom: '48px' }}>Thousands of producers share tips, presets, feedback, and music every day.</p>
          <div className="community-cards">
            <div className="glass-card community-card">
              <div className="community-card-icon community-discord-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.032.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg></div>
              <h3 className="community-card-title">Discord Server</h3>
              <p className="community-card-desc">Join 3,200+ producers on our Discord. Share your tracks, get feedback, participate in beat battles, and get direct access to the dev team.</p>
              <div className="community-stats"><div className="community-stat"><span className="community-stat-value">3,200+</span><span className="community-stat-label">Members</span></div><div className="community-stat"><span className="community-stat-value">24/7</span><span className="community-stat-label">Active</span></div><div className="community-stat"><span className="community-stat-value">Dev team</span><span className="community-stat-label">Accessible</span></div></div>
              <a href="#" className="btn-primary community-btn">Join Discord Server</a>
            </div>
            <div className="glass-card community-card">
              <div className="community-card-icon community-github-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg></div>
              <h3 className="community-card-title">GitHub</h3>
              <p className="community-card-desc">NeuroTek AI's issue tracker and public roadmap live on GitHub. Report bugs, vote on features, and follow our development progress in the open.</p>
              <div className="community-stats"><div className="community-stat"><span className="community-stat-value">Public</span><span className="community-stat-label">Roadmap</span></div><div className="community-stat"><span className="community-stat-value">Open</span><span className="community-stat-label">Issues</span></div><div className="community-stat"><span className="community-stat-value">MIT</span><span className="community-stat-label">Docs License</span></div></div>
              <a href="#" className="btn-secondary community-btn">View on GitHub</a>
            </div>
            <div className="glass-card community-card">
              <div className="community-card-icon community-docs-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4h16v17H4V4z" /><path d="M8 9h8M8 13h6M8 17h4" /></svg></div>
              <h3 className="community-card-title">Documentation</h3>
              <p className="community-card-desc">Comprehensive guides covering everything from first launch to advanced VST hosting and MIDI routing. Available online and as a downloadable PDF.</p>
              <div className="community-stats"><div className="community-stat"><span className="community-stat-value">40+</span><span className="community-stat-label">Guides</span></div><div className="community-stat"><span className="community-stat-value">Video</span><span className="community-stat-label">Tutorials</span></div><div className="community-stat"><span className="community-stat-value">PDF</span><span className="community-stat-label">Download</span></div></div>
              <a href="#" className="btn-secondary community-btn">Read the Docs</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section support-contact-section" id="contact">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-header">
              <div className="section-label">Direct Contact</div>
              <h2 className="section-title">Still need <span className="gradient-text">help?</span></h2>
              <p className="section-subtitle">Our team reads every email. For fastest response, check the FAQ and Discord first.</p>
            </div>
            <div className="contact-cards">
              <div className="glass-card contact-card">
                <div className="contact-card-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 8l10 6 10-6" /></svg></div>
                <div><h3 className="contact-card-title">Support Email</h3><p className="contact-card-email">support@neurotek.ai</p><p className="contact-card-note"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" /><path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /></svg>Usually within 24 hours</p></div>
              </div>
              <div className="glass-card contact-card">
                <div className="contact-card-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg></div>
                <div>
                  <h3 className="contact-card-title">Response Times</h3>
                  <div className="contact-response-list">
                    <div className="contact-response-item"><span className="contact-response-tier">Free users</span><span className="contact-response-time">Within 48h</span></div>
                    <div className="contact-response-item"><span className="contact-response-tier">Pro users</span><span className="contact-response-time contact-priority">Within 24h</span></div>
                    <div className="contact-response-item"><span className="contact-response-tier">Studio users</span><span className="contact-response-time contact-vip">Within 4h</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Support

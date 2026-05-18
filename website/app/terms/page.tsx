export const metadata = { title: 'Terms of Service — Neurotek AI' }

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24">
      <h1 className="text-4xl font-bold text-nt-text mb-2">Terms of Service</h1>
      <p className="text-nt-muted text-sm mb-12">Last updated: May 2025 — Beta</p>
      <div className="space-y-8 text-nt-muted text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">1. Acceptance</h2>
          <p>By downloading or using Neurotek Studio you agree to these terms. If you do not agree, do not use the software.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">2. License</h2>
          <p>Neurotek Studio is provided under the MIT license. Source code is available at github.com/mixpiloteai-oss/mixpiloteai. You may use, modify, and distribute it subject to the license terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">3. AI Generations</h2>
          <p>AI-generated content (MIDI patterns, chord progressions) is owned by you. We claim no rights over content you create using the software.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">4. Acceptable Use</h2>
          <p>Do not use the API endpoints to circumvent usage quotas, attempt unauthorized access, or harm other users.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">5. Disclaimer</h2>
          <p>The software is provided as-is during beta. We make no warranties regarding uptime, data retention, or fitness for a particular purpose.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">6. Contact</h2>
          <p>Legal questions: <a href="mailto:legal@neurotek.ai" className="text-nt-purple hover:underline">legal@neurotek.ai</a></p>
        </section>
      </div>
    </div>
  )
}

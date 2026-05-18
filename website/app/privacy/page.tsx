export const metadata = { title: 'Privacy Policy — Neurotek AI' }

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24">
      <h1 className="text-4xl font-bold text-nt-text mb-2">Privacy Policy</h1>
      <p className="text-nt-muted text-sm mb-12">Last updated: May 2025 — Beta</p>
      <div className="prose prose-invert max-w-none space-y-8 text-nt-muted text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">1. Data We Collect</h2>
          <p>We collect your email address, display name, and hashed password when you register. Usage metrics (AI generation count) are stored to enforce plan limits. No audio or MIDI data is ever uploaded unless you explicitly use cloud sync.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">2. How We Use It</h2>
          <p>Your data is used solely to operate the service: authentication, quota enforcement, and cloud sync. We never sell data to third parties.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">3. Third Parties</h2>
          <p>We use Supabase for database hosting and Anthropic&apos;s API for AI generation. Neither service receives your creative content unless you trigger an AI generation request.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">4. Your Rights</h2>
          <p>You may request deletion of your account and all associated data by emailing <a href="mailto:privacy@neurotek.ai" className="text-nt-purple hover:underline">privacy@neurotek.ai</a>.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-nt-text mb-2">5. Contact</h2>
          <p>Questions? Email <a href="mailto:privacy@neurotek.ai" className="text-nt-purple hover:underline">privacy@neurotek.ai</a>.</p>
        </section>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import './Legal.css'

function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="container">
          <div className="section-label">Legal</div>
          <h1 className="legal-title">Privacy <span className="gradient-text">Policy</span></h1>
          <p className="legal-meta">Last updated: May 14, 2025 &bull; Effective: May 14, 2025</p>
        </div>
      </div>

      <div className="legal-body">
        <div className="container">
          <div className="legal-content">

            <div className="legal-notice">
              <strong>Beta Software Notice.</strong> NeuroTek AI is currently in public beta. This policy describes how we handle data during and after the beta period.
            </div>

            <section className="legal-section">
              <h2>1. Who We Are</h2>
              <p>NeuroTek AI ("we", "our", "us") is the developer of the NeuroTek AI music production application and website located at neurotek.ai. Contact us at <a href="mailto:privacy@neurotek.ai">privacy@neurotek.ai</a>.</p>
            </section>

            <section className="legal-section">
              <h2>2. Information We Collect</h2>
              <h3>Account Information</h3>
              <p>When you create an account: email address, display name, and hashed password. We never store plaintext passwords.</p>
              <h3>Usage Data</h3>
              <p>We collect anonymized usage analytics including: features used, AI generation counts, session duration, and error reports. This data is aggregated and never sold.</p>
              <h3>AI Prompts and Outputs</h3>
              <p>Text prompts you send to our AI service are processed to generate music. We may retain prompts for up to 30 days for debugging and quality improvement. You can request deletion at any time.</p>
              <h3>Desktop App</h3>
              <p>The NeuroTek AI desktop app stores project files and settings locally on your machine. Crash logs may be sent automatically if you opt in.</p>
            </section>

            <section className="legal-section">
              <h2>3. How We Use Your Information</h2>
              <ul>
                <li>To provide and improve the NeuroTek AI service</li>
                <li>To enforce usage quotas and billing (paid plans)</li>
                <li>To send product updates you opt into</li>
                <li>To investigate bugs and crashes</li>
                <li>To comply with legal obligations</li>
              </ul>
              <p>We do <strong>not</strong> sell your personal data. We do not use your music projects to train AI models without explicit opt-in consent.</p>
            </section>

            <section className="legal-section">
              <h2>4. Data Sharing</h2>
              <p>We share data only with:</p>
              <ul>
                <li><strong>Anthropic</strong> — AI text generation (subject to Anthropic's usage policy)</li>
                <li><strong>Infrastructure providers</strong> — hosting, CDN, email delivery (data processors under contract)</li>
                <li><strong>Law enforcement</strong> — only when legally required</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>5. Data Retention</h2>
              <p>Account data is retained while your account is active. You may request full deletion by emailing <a href="mailto:privacy@neurotek.ai">privacy@neurotek.ai</a>. We will process deletion requests within 30 days. Aggregated/anonymized analytics are retained indefinitely.</p>
            </section>

            <section className="legal-section">
              <h2>6. Cookies</h2>
              <p>The website uses only essential session cookies for authentication. We do not use advertising or third-party tracking cookies.</p>
            </section>

            <section className="legal-section">
              <h2>7. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to: access your data, correct inaccuracies, request deletion, and opt out of communications. Email <a href="mailto:privacy@neurotek.ai">privacy@neurotek.ai</a> to exercise any of these rights.</p>
            </section>

            <section className="legal-section">
              <h2>8. Security</h2>
              <p>We use TLS encryption in transit, bcrypt password hashing, and access controls. No system is 100% secure — please use a strong, unique password.</p>
            </section>

            <section className="legal-section">
              <h2>9. Children</h2>
              <p>NeuroTek AI is not directed at children under 13. We do not knowingly collect data from children.</p>
            </section>

            <section className="legal-section">
              <h2>10. Changes to This Policy</h2>
              <p>We will notify registered users of material changes via email and an in-app notice at least 14 days before the change takes effect.</p>
            </section>

            <section className="legal-section">
              <h2>11. Contact</h2>
              <p>For privacy questions: <a href="mailto:privacy@neurotek.ai">privacy@neurotek.ai</a></p>
            </section>

            <div className="legal-footer-links">
              <Link to="/terms">Terms of Service →</Link>
              <Link to="/support">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Privacy

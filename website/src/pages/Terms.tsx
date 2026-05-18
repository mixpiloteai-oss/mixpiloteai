import { Link } from 'react-router-dom'
import './Legal.css'

function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="container">
          <div className="section-label">Legal</div>
          <h1 className="legal-title">Terms of <span className="gradient-text">Service</span></h1>
          <p className="legal-meta">Last updated: May 14, 2025 &bull; Effective: May 14, 2025</p>
        </div>
      </div>

      <div className="legal-body">
        <div className="container">
          <div className="legal-content">

            <div className="legal-notice">
              <strong>Beta Software Notice.</strong> NeuroTek AI is currently in public beta. Features, pricing, and these terms may change before the stable release. We will notify you of material changes.
            </div>

            <section className="legal-section">
              <h2>1. Acceptance of Terms</h2>
              <p>By downloading, installing, or using NeuroTek AI (the "Service"), you agree to these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms form a binding agreement between you and NeuroTek AI ("we", "our", "us").</p>
            </section>

            <section className="legal-section">
              <h2>2. Description of Service</h2>
              <p>NeuroTek AI is an AI-powered music production desktop application and associated web services. The Service includes the desktop application, the website at neurotek.ai, AI generation features, project storage, and community features.</p>
            </section>

            <section className="legal-section">
              <h2>3. Eligibility</h2>
              <p>You must be at least 13 years old to use NeuroTek AI. If you are under 18, you must have parental or guardian consent. By using the Service, you represent that you meet these requirements.</p>
            </section>

            <section className="legal-section">
              <h2>4. Account Registration</h2>
              <p>Some features require an account. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us immediately of any unauthorized access at <a href="mailto:support@neurotek.ai">support@neurotek.ai</a>.</p>
            </section>

            <section className="legal-section">
              <h2>5. Free Tier and Paid Plans</h2>
              <p>NeuroTek AI offers a free tier with limited AI generation credits. Paid plans ("Pro" and "Studio") unlock additional features and higher quotas. Pricing is listed at <Link to="/pricing">neurotek.ai/pricing</Link>. Subscriptions are billed monthly or annually and may be cancelled at any time.</p>
              <p>During the beta period, all features may be made available for free or at a discount. Pricing may change when we leave beta with 30 days notice to registered users.</p>
            </section>

            <section className="legal-section">
              <h2>6. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Service to generate content that is illegal, harmful, harassing, or infringes third-party rights</li>
                <li>Reverse engineer, decompile, or extract the underlying AI models</li>
                <li>Attempt to circumvent usage quotas or access controls</li>
                <li>Use automated scripts to abuse the AI generation service</li>
                <li>Resell or sublicense access to the Service</li>
                <li>Use the Service in ways that violate Anthropic's usage policies (which govern our AI features)</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>7. Your Content and Ownership</h2>
              <p>You retain full ownership of music, projects, and content you create using NeuroTek AI. By using the Service, you grant us a limited license to process and store your content solely to provide the Service.</p>
              <p>We do <strong>not</strong> claim ownership of your music. We do not use your music projects to train AI models without explicit opt-in consent.</p>
            </section>

            <section className="legal-section">
              <h2>8. AI-Generated Content</h2>
              <p>AI-generated musical elements produced by NeuroTek AI are provided to you for use in your projects. Copyright ownership of AI-generated output may vary by jurisdiction. You are responsible for ensuring your use of AI-generated content complies with applicable law.</p>
            </section>

            <section className="legal-section">
              <h2>9. Intellectual Property</h2>
              <p>The NeuroTek AI application, brand, and website are owned by NeuroTek AI. The application source code is open-source under the MIT License where indicated. Third-party components retain their respective licenses.</p>
            </section>

            <section className="legal-section">
              <h2>10. Disclaimers</h2>
              <p>The Service is provided "as is" without warranty of any kind. We do not guarantee that the Service will be error-free, uninterrupted, or that AI-generated content will meet your expectations. Use the Service at your own risk.</p>
            </section>

            <section className="legal-section">
              <h2>11. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, NeuroTek AI shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, even if we have been advised of the possibility of such damages.</p>
            </section>

            <section className="legal-section">
              <h2>12. Termination</h2>
              <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time by contacting <a href="mailto:support@neurotek.ai">support@neurotek.ai</a>. Upon termination, your right to use the Service ends immediately.</p>
            </section>

            <section className="legal-section">
              <h2>13. Changes to Terms</h2>
              <p>We may update these Terms from time to time. We will notify registered users of material changes by email and in-app notice at least 14 days before the change takes effect. Continued use of the Service after changes constitutes acceptance.</p>
            </section>

            <section className="legal-section">
              <h2>14. Governing Law</h2>
              <p>These Terms are governed by applicable law. Any disputes will be resolved through binding arbitration or in courts of competent jurisdiction, as permitted by law.</p>
            </section>

            <section className="legal-section">
              <h2>15. Contact</h2>
              <p>For questions about these Terms: <a href="mailto:legal@neurotek.ai">legal@neurotek.ai</a></p>
            </section>

            <div className="legal-footer-links">
              <Link to="/privacy">Privacy Policy →</Link>
              <Link to="/support">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Terms

import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Pricing.css'

interface PlanFeature { text: string; included: boolean }
interface Plan { name: string; price: string; period: string; description: string; features: PlanFeature[]; cta: string; ctaLink: string; popular: boolean; badge?: string }

const plans: Plan[] = [
  {
    name: 'Free', price: '$0', period: 'forever', description: 'Perfect for getting started and exploring what AI music production can do.',
    features: [
      { text: '10 AI generations / month', included: true }, { text: 'Piano Roll editor', included: true }, { text: 'Arrangement timeline', included: true },
      { text: '5 project slots', included: true }, { text: 'WAV & MIDI export', included: true }, { text: 'Community support', included: true },
      { text: 'Sample browser + packs marketplace', included: false }, { text: 'Priority support', included: false }, { text: 'VST plugin hosting', included: false },
    ],
    cta: 'Download Free', ctaLink: '/download', popular: false,
  },
  {
    name: 'Pro', price: '$9', period: 'per month', description: 'For serious producers who want unlimited creative power and access to pro tools.',
    features: [
      { text: '200 AI generations / month', included: true }, { text: 'Piano Roll editor', included: true }, { text: 'Arrangement timeline', included: true },
      { text: 'Unlimited project slots', included: true }, { text: 'WAV, MP3 & MIDI export', included: true }, { text: 'Priority support', included: true },
      { text: 'Sample browser + packs marketplace', included: true }, { text: 'Early access to beta features', included: true }, { text: 'VST plugin hosting', included: false },
    ],
    cta: 'Start Pro — $9/mo', ctaLink: '#', popular: true, badge: 'Most Popular',
  },
  {
    name: 'Studio', price: '$19', period: 'per month', description: 'The full professional suite for power users, studios, and music educators.',
    features: [
      { text: 'Unlimited AI generations', included: true }, { text: 'Piano Roll editor', included: true }, { text: 'Arrangement timeline', included: true },
      { text: 'Unlimited project slots', included: true }, { text: 'WAV, MP3 & MIDI export', included: true }, { text: 'Sample browser + packs marketplace', included: true },
      { text: 'Early access to beta features', included: true }, { text: 'VST plugin hosting (VST/VST3)', included: true }, { text: 'Commercial license included', included: true },
    ],
    cta: 'Start Studio — $19/mo', ctaLink: '#', popular: false,
  },
]

const faqs = [
  { question: 'Can I switch between plans at any time?', answer: 'Yes, you can upgrade or downgrade your plan at any time from your account settings. Upgrades take effect immediately; downgrades take effect at the end of the billing period.' },
  { question: 'How does billing work?', answer: 'We bill monthly or annually (annual billing saves 20%). We accept all major credit cards. For Studio plans, you can request an invoice.' },
  { question: 'What happens to my projects if I cancel?', answer: "Your projects are never deleted. Cancelling downgrades you to Free. Projects beyond the 5-slot limit are archived (not deleted) and restored if you resubscribe." },
  { question: 'Do I own the music I create with NeuroTek AI?', answer: 'Yes — 100%. Free and Pro plans include a personal use license. Studio includes a full commercial license.' },
]

function Pricing() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const getDisplayPrice = (plan: Plan) => {
    if (plan.price === '$0') return '$0'
    const base = parseInt(plan.price.replace('$', ''))
    return annual ? `$${Math.floor(base * 0.8)}` : plan.price
  }

  return (
    <div className="pricing-page">
      <div className="pricing-hero">
        <div className="pricing-hero-bg" aria-hidden="true"><div className="pricing-orb-1" /><div className="pricing-orb-2" /></div>
        <div className="container">
          <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
          <h1 className="pricing-title">Simple, transparent <span className="gradient-text">pricing</span></h1>
          <p className="pricing-subtitle">Start free and upgrade when you need more power. No hidden fees, no surprises.</p>
          <div className="billing-toggle">
            <span className={!annual ? 'billing-option active' : 'billing-option'}>Monthly</span>
            <button className={`toggle-switch${annual ? ' annual' : ''}`} onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing" role="switch" aria-checked={annual}>
              <span className="toggle-knob" />
            </button>
            <span className={annual ? 'billing-option active' : 'billing-option'}>Annual <span className="billing-save-badge">Save 20%</span></span>
          </div>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <div className="plans-grid">
            {plans.map((plan) => (
              <div key={plan.name} className={`plan-card glass-card${plan.popular ? ' plan-popular' : ''}`}>
                {plan.badge && <div className="plan-popular-badge"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9 3 11l.5-3.5L1 5l3.5-.5L6 1z" fill="currentColor" /></svg>{plan.badge}</div>}
                <div className="plan-header">
                  <h2 className="plan-name">{plan.name}</h2>
                  <div className="plan-price">
                    <span className="plan-price-amount">{getDisplayPrice(plan)}</span>
                    <span className="plan-price-period">{plan.price !== '$0' ? (annual ? '/ mo, billed annually' : '/ month') : 'forever'}</span>
                  </div>
                  <p className="plan-desc">{plan.description}</p>
                </div>
                <Link to={plan.ctaLink} className={plan.popular ? 'btn-primary plan-cta' : 'btn-secondary plan-cta'}>{plan.cta}</Link>
                <div className="plan-divider" />
                <ul className="plan-features">
                  {plan.features.map((feature, i) => (
                    <li key={i} className={`plan-feature${!feature.included ? ' plan-feature-missing' : ''}`}>
                      {feature.included
                        ? <svg className="plan-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="rgba(167,139,250,0.15)" /><path d="M5 8l2.5 2.5L11 5.5" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <svg className="plan-x" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.03)" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      }
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="enterprise-note"><p>Need a custom plan for a studio or team of 10+? <a href="mailto:sales@neurotek.ai">Contact us for Enterprise pricing →</a></p></div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="container">
          <div className="faq-header"><div className="section-label">FAQ</div><h2 className="section-title">Frequently asked <span className="gradient-text">questions</span></h2></div>
          <div className="faq-list">
            {faqs.map((item, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{item.question}</span>
                  <svg className="faq-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className="faq-answer"><div className="faq-answer-inner"><p>{item.answer}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm pricing-cta-section">
        <div className="container">
          <div className="pricing-cta">
            <h2>Start making music <span className="gradient-text">today</span></h2>
            <p>No commitment. Download the free version and upgrade anytime.</p>
            <div className="pricing-cta-btns">
              <Link to="/download" className="btn-primary"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>Download Free</Link>
              <a href="#" className="btn-secondary">Start Pro — $9/mo</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Pricing

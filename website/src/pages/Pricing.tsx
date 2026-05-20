import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Pricing.css'

interface PlanDef {
  id: string
  name: string
  monthlyPrice: number
  annualPrice: number
  badge: string | null
  popular: boolean
  color: string
  description: string
  features: string[]
  notIncluded: string[]
  cta: string
}

interface ApiPlan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  dailyAIRequests: number
  maxProjects: number
  features: string[]
  trialDays: number
  active: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'free', name: 'Free', monthlyPrice: 0, annualPrice: 0,
    badge: null, popular: false, color: '#475569',
    description: 'Explore AI music production at zero cost.',
    features: [
      '10 AI generations / month', '3 project slots', 'Piano Roll + Arrangement',
      'WAV & MIDI export', 'Community support', 'Basic templates (3)',
    ],
    notIncluded: ['Marketplace access', 'Plugin hosting', 'Cloud sync', 'Commercial license'],
    cta: 'Download Free',
  },
  {
    id: 'pro', name: 'Pro', monthlyPrice: 9.99, annualPrice: 7.99,
    badge: 'Most Popular', popular: true, color: '#7c3aed',
    description: 'Everything you need for serious production.',
    features: [
      '200 AI generations / month', 'Unlimited project slots', 'All export formats (WAV/MP3/FLAC)',
      'Marketplace access + 5 free packs', 'AI Mix Assistant', 'Priority support',
      'Early beta access', 'Commercial license',
    ],
    notIncluded: ['VST plugin hosting', 'Team collaboration', 'API access'],
    cta: 'Start Pro',
  },
  {
    id: 'studio', name: 'Studio', monthlyPrice: 24.99, annualPrice: 19.99,
    badge: 'Best Value', popular: false, color: '#06b6d4',
    description: 'The full professional suite for power users.',
    features: [
      '1000 AI generations / month', 'Unlimited everything', 'VST/AU plugin hosting',
      'Cloud project sync', 'Collaboration (up to 3 members)', 'Creator Dashboard',
      'API access', 'Commercial license', 'Dedicated support',
    ],
    notIncluded: ['Unlimited AI (no cap)', 'White-label exports', 'Full team (10+)'],
    cta: 'Start Studio',
  },
  {
    id: 'label', name: 'Label', monthlyPrice: 79.99, annualPrice: 63.99,
    badge: 'For Labels & Studios', popular: false, color: '#f59e0b',
    description: 'Built for professional studios and record labels.',
    features: [
      'Unlimited AI generations', 'Up to 10 team members', 'White-label exports',
      'Custom model fine-tuning', 'Bulk project export', 'SLA + dedicated engineer',
      'Invoicing & VAT management', 'Revenue split tools', 'Full API + webhooks',
    ],
    notIncluded: [],
    cta: 'Contact Sales',
  },
]

const FAQS = [
  { question: 'Can I switch between plans at any time?', answer: 'Yes, you can upgrade or downgrade your plan at any time from your account settings. Upgrades take effect immediately; downgrades take effect at the end of the billing period.' },
  { question: 'How does billing work?', answer: 'We bill monthly or annually (annual billing saves 20%). We accept all major credit cards via Stripe, plus PayPal. For Label plans, we can also issue invoices.' },
  { question: 'What happens to my projects if I cancel?', answer: "Your projects are never deleted. Cancelling downgrades you to Free. Projects beyond the Free limit are archived (not deleted) and restored if you resubscribe." },
  { question: 'Do I own the music I create with NeuroTek AI?', answer: 'Yes — 100%. Free plans include personal use. Pro, Studio, and Label plans include a full commercial license so you can monetise your tracks.' },
  { question: 'What payment methods do you accept?', answer: 'We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover) through Stripe, as well as PayPal. EU customers can also provide a VAT number for B2B invoicing.' },
  { question: 'Is there a free trial?', answer: 'The Free plan is your trial — use it as long as you like with no credit card required. Paid plans don\'t have a separate trial period, but you get a 14-day money-back guarantee.' },
  { question: 'How does VAT work for EU customers?', answer: 'EU customers are charged VAT at their local rate (e.g. 20% in France, 19% in Germany). If you have a valid EU VAT number, enter it at checkout and VAT will be zero-rated for B2B transactions.' },
  { question: 'Can I get a refund?', answer: 'Yes. We offer a 14-day money-back guarantee on all paid plans. Contact support within 14 days of your first payment and we\'ll issue a full refund, no questions asked.' },
  { question: 'What happens to my data if I cancel?', answer: 'Your account and all project data are retained for 90 days after cancellation. After that, inactive accounts are anonymised. You can request a full export of your data at any time.' },
]

interface CreditPack { credits: number; price: number; pkg: string }
const CREDIT_PACKS: CreditPack[] = [
  { credits: 100, price: 4.99, pkg: '100' },
  { credits: 500, price: 19.99, pkg: '500' },
  { credits: 2000, price: 69.99, pkg: '2000' },
]

const COMPARISON_ROWS: { feature: string; free: string; pro: string; studio: string; label: string }[] = [
  { feature: 'AI Generations', free: '10/mo', pro: '200/mo', studio: '1,000/mo', label: 'Unlimited' },
  { feature: 'Project Slots', free: '3', pro: 'Unlimited', studio: 'Unlimited', label: 'Unlimited' },
  { feature: 'Export Formats', free: 'WAV+MIDI', pro: '+MP3+FLAC', studio: 'All', label: 'All' },
  { feature: 'Marketplace', free: '—', pro: '✓', studio: '✓', label: '✓' },
  { feature: 'VST Hosting', free: '—', pro: '—', studio: '✓', label: '✓' },
  { feature: 'Cloud Sync', free: '—', pro: '—', studio: '✓', label: '✓' },
  { feature: 'Collaboration', free: '—', pro: '—', studio: '3 members', label: '10 members' },
  { feature: 'API Access', free: '—', pro: '—', studio: '✓', label: '✓' },
  { feature: 'Commercial License', free: '—', pro: '✓', studio: '✓', label: '✓' },
  { feature: 'Support', free: 'Community', pro: 'Priority', studio: 'Dedicated', label: 'SLA' },
  { feature: 'Creator Dashboard', free: '—', pro: '—', studio: '✓', label: '✓' },
]

type CouponStatus = 'idle' | 'valid' | 'invalid'

const COUPON_CODES: Record<string, string> = {
  LAUNCH50: '50% off first month!',
  WELCOME: '$5 off your first payment',
}

// Map API plan to PlanDef for rendering (preserves existing card UI)
function apiPlanToPlanDef(ap: ApiPlan): PlanDef {
  const PLAN_COLORS: Record<string, string> = {
    free: '#475569', pro: '#7c3aed', studio: '#06b6d4', label: '#f59e0b',
  }
  const PLAN_BADGES: Record<string, string | null> = {
    free: null, pro: 'Most Popular', studio: 'Best Value', label: 'For Labels & Studios',
  }
  const PLAN_POPULAR: Record<string, boolean> = {
    free: false, pro: true, studio: false, label: false,
  }
  const PLAN_DESC: Record<string, string> = {
    free: 'Explore AI music production at zero cost.',
    pro: 'Everything you need for serious production.',
    studio: 'The full professional suite for power users.',
    label: 'Built for professional studios and record labels.',
  }
  const PLAN_NOTINCLUDED: Record<string, string[]> = {
    free: ['Marketplace access', 'Plugin hosting', 'Cloud sync', 'Commercial license'],
    pro: ['VST plugin hosting', 'Team collaboration', 'API access'],
    studio: ['Unlimited AI (no cap)', 'White-label exports', 'Full team (10+)'],
    label: [],
  }
  const PLAN_CTA: Record<string, string> = {
    free: 'Download Free', pro: 'Start Pro', studio: 'Start Studio', label: 'Contact Sales',
  }
  return {
    id: ap.id,
    name: ap.name,
    monthlyPrice: ap.priceMonthly,
    annualPrice: ap.priceYearly,
    badge: PLAN_BADGES[ap.id] ?? null,
    popular: PLAN_POPULAR[ap.id] ?? false,
    color: PLAN_COLORS[ap.id] ?? '#475569',
    description: PLAN_DESC[ap.id] ?? '',
    features: ap.features,
    notIncluded: PLAN_NOTINCLUDED[ap.id] ?? [],
    cta: PLAN_CTA[ap.id] ?? 'Get Started',
  }
}

function Pricing() {
  const navigate = useNavigate()
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<CouponStatus>('idle')
  const [couponMessage, setCouponMessage] = useState('')
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([])
  const [, setPlansLoading] = useState(true)

  useEffect(() => {
    import('../lib/api').then(({ apiGet }) =>
      (apiGet as (path: string) => Promise<{ success: boolean; data: ApiPlan[] }>)(
        '/api/subscriptions/plans'
      )
        .then(res => { if (res.data) setApiPlans(res.data) })
        .catch(() => {})
        .finally(() => setPlansLoading(false))
    )
  }, [])

  const displayPlans: PlanDef[] = apiPlans.length > 0
    ? apiPlans.filter(ap => ap.active).map(apiPlanToPlanDef)
    : PLANS

  const getPrice = (plan: PlanDef): number =>
    annual ? plan.annualPrice : plan.monthlyPrice

  const formatPrice = (price: number) =>
    price === 0 ? '$0' : `$${price.toFixed(2)}`

  const handleCoupon = () => {
    const trimmed = couponCode.trim().toUpperCase()
    if (COUPON_CODES[trimmed]) {
      setCouponStatus('valid')
      setCouponMessage(COUPON_CODES[trimmed])
    } else {
      setCouponStatus('invalid')
      setCouponMessage('Invalid coupon code. Please try again.')
    }
  }

  const handlePlanCta = (plan: PlanDef) => {
    if (plan.id === 'free') { navigate('/download'); return }
    if (plan.id === 'label') { navigate('/support'); return }
    navigate(`/checkout?plan=${plan.id}${annual ? '&annual=true' : ''}`)
  }

  const cellClass = (val: string) => {
    if (val === '✓') return 'comparison-check'
    if (val === '—') return 'comparison-dash'
    return 'comparison-val'
  }

  return (
    <div className="pricing-page">
      {/* Hero */}
      <div className="pricing-hero">
        <div className="pricing-hero-bg" aria-hidden="true">
          <div className="pricing-orb-1" />
          <div className="pricing-orb-2" />
        </div>
        <div className="container">
          <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
          <h1 className="pricing-title">Simple, transparent <span className="gradient-text">pricing</span></h1>
          <p className="pricing-subtitle">Start free and upgrade when you need more power. No hidden fees, no surprises.</p>

          {/* Billing toggle */}
          <div className="billing-toggle">
            <span className={!annual ? 'billing-option active' : 'billing-option'}>Monthly</span>
            <button
              className={`toggle-switch${annual ? ' annual' : ''}`}
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual billing"
              role="switch"
              aria-checked={annual}
            >
              <span className="toggle-knob" />
            </button>
            <span className={annual ? 'billing-option active' : 'billing-option'}>
              Annual <span className="billing-save-badge">Save 20%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <section className="section-sm">
        <div className="container">
          <div className="pricing-grid">
            {displayPlans.map((plan) => {
              const price = getPrice(plan)
              const monthlyFull = plan.monthlyPrice
              const isPopular = plan.popular
              return (
                <div
                  key={plan.id}
                  className={`plan-card glass-card${isPopular ? ' plan-card-popular' : ''}`}
                  style={{ '--plan-color': plan.color } as React.CSSProperties}
                >
                  {plan.badge && (
                    <div className="plan-badge" style={{ background: plan.color }}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="plan-header">
                    <h2 className="plan-name" style={{ color: plan.color }}>{plan.name}</h2>
                    <div className="plan-price-wrap">
                      <div className="plan-price-row">
                        <span className="plan-price-amount">{formatPrice(price)}</span>
                        {price > 0 && <span className="plan-price-period">/ mo</span>}
                        {price === 0 && <span className="plan-price-period">forever</span>}
                      </div>
                      {annual && plan.monthlyPrice > 0 && (
                        <div className="plan-price-was">
                          <span className="plan-price-strike">${monthlyFull.toFixed(2)}/mo</span>
                          <span className="plan-price-billed">billed annually</span>
                        </div>
                      )}
                    </div>
                    <p className="plan-desc">{plan.description}</p>
                  </div>

                  <button
                    className={isPopular ? 'btn-primary plan-cta' : 'btn-secondary plan-cta'}
                    onClick={() => handlePlanCta(plan)}
                  >
                    {plan.cta}
                  </button>
                  {plan.id !== 'free' && plan.id !== 'label' && (
                    <p className="plan-trial-note">Start free trial — no credit card required</p>
                  )}

                  <div className="plan-divider" />

                  <ul className="plan-feature-list">
                    {plan.features.map((f, i) => (
                      <li key={i} className="plan-feature plan-feature-included">
                        <span className="plan-feature-icon plan-feature-check">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((f, i) => (
                      <li key={`x-${i}`} className="plan-feature plan-feature-excluded">
                        <span className="plan-feature-icon plan-feature-dash">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Enterprise note */}
          <div className="enterprise-note">
            <p>Need a custom plan for a studio or team of 10+?{' '}
              <a href="mailto:sales@neurotek.ai">Contact us for Enterprise pricing →</a>
            </p>
          </div>
        </div>
      </section>

      {/* Coupon banner */}
      <section className="section-sm coupon-section">
        <div className="container">
          <div className="coupon-banner glass-card">
            <span className="coupon-label">Have a coupon?</span>
            <div className="coupon-input-row">
              <input
                type="text"
                className="coupon-input"
                placeholder="Enter code (e.g. LAUNCH50)"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value); setCouponStatus('idle') }}
                onKeyDown={e => e.key === 'Enter' && handleCoupon()}
              />
              <button className="btn-primary coupon-apply-btn" onClick={handleCoupon}>Apply</button>
            </div>
            {couponStatus === 'valid' && (
              <p className="coupon-msg coupon-msg-valid">✓ {couponMessage}</p>
            )}
            {couponStatus === 'invalid' && (
              <p className="coupon-msg coupon-msg-invalid">✗ {couponMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="section">
        <div className="container">
          <div className="faq-header">
            <div className="section-label">Compare</div>
            <h2 className="section-title">Full feature <span className="gradient-text">comparison</span></h2>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="comparison-feature-col">Feature</th>
                  {displayPlans.map(p => (
                    <th key={p.id} className={p.popular ? 'comparison-plan-col comparison-plan-popular' : 'comparison-plan-col'}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td className="comparison-feature-name">{row.feature}</td>
                    {(['free', 'pro', 'studio', 'label'] as const).map(col => (
                      <td key={col} className={`comparison-cell ${cellClass(row[col])}`}>
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* AI Credits add-on */}
      <section className="section-sm credits-section">
        <div className="container">
          <div className="faq-header">
            <div className="section-label">Add-ons</div>
            <h2 className="section-title">AI Credit <span className="gradient-text">packs</span></h2>
            <p className="pricing-subtitle" style={{ marginTop: 8 }}>Top up your AI generations any time. Credits never expire.</p>
          </div>
          <div className="credits-grid">
            {CREDIT_PACKS.map(pack => (
              <div key={pack.pkg} className="credit-card glass-card">
                <div className="credit-amount">{pack.credits.toLocaleString()}</div>
                <div className="credit-label">AI Credits</div>
                <div className="credit-price">${pack.price.toFixed(2)}</div>
                <div className="credit-per">${(pack.price / pack.credits).toFixed(3)} per credit</div>
                <Link
                  to={`/checkout?type=credits&pkg=${pack.pkg}`}
                  className="btn-secondary credit-btn"
                >
                  Buy Credits →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="section-sm trust-section">
        <div className="container">
          <div className="trust-badges">
            <div className="trust-badge">
              <span className="trust-icon">🔒</span>
              <span>SSL Encrypted</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">↩️</span>
              <span>14-day refund</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">✓</span>
              <span>Cancel anytime</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">💳</span>
              <span>Stripe + PayPal</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section faq-section">
        <div className="container">
          <div className="faq-header">
            <div className="section-label">FAQ</div>
            <h2 className="section-title">Frequently asked <span className="gradient-text">questions</span></h2>
          </div>
          <div className="faq-list">
            {FAQS.map((item, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{item.question}</span>
                  <svg className="faq-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner"><p>{item.answer}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="section-sm pricing-cta-section">
        <div className="container">
          <div className="pricing-cta">
            <h2>Start making music <span className="gradient-text">today</span></h2>
            <p>No commitment. Download the free version and upgrade anytime.</p>
            <div className="pricing-cta-btns">
              <Link to="/download" className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Free
              </Link>
              <Link to="/checkout?plan=pro" className="btn-secondary">Start Pro — $9.99/mo</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Pricing

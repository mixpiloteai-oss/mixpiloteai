import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { authTokens, isTokenExpired } from '../lib/api'
import './Checkout.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'details' | 'payment' | 'processing' | 'done'
type PaymentMethod = 'card' | 'paypal'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLAN_INFO: Record<string, { name: string; monthlyPrice: number; annualPrice: number }> = {
  pro:    { name: 'Pro',    monthlyPrice: 9.99,  annualPrice: 7.99  },
  studio: { name: 'Studio', monthlyPrice: 24.99, annualPrice: 19.99 },
  label:  { name: 'Label',  monthlyPrice: 79.99, annualPrice: 63.99 },
}

const CREDIT_PACKS: Record<string, { credits: number; price: number }> = {
  '100':  { credits: 100,  price: 4.99  },
  '500':  { credits: 500,  price: 19.99 },
  '2000': { credits: 2000, price: 69.99 },
}

const EU_RATES: Record<string, number> = {
  FR: 0.20, DE: 0.19, GB: 0.20, IT: 0.22, ES: 0.21, NL: 0.21,
  BE: 0.21, PT: 0.23, AT: 0.20, PL: 0.23, SE: 0.25, DK: 0.25,
  FI: 0.24, IE: 0.23, CZ: 0.21, HU: 0.27, RO: 0.19, SK: 0.20,
}

const EU_COUNTRIES = Object.keys(EU_RATES)

const COUPON_CODES: Record<string, { label: string; discount: number }> = {
  LAUNCH50: { label: '50% off first month', discount: 0.5 },
  WELCOME:  { label: '$5 off your first payment', discount: 5 },
}

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'AT', name: 'Austria' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'OTHER', name: 'Other' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCardBrand(number: string): string {
  const n = number.replace(/\s/g, '')
  if (/^4/.test(n)) return 'Visa'
  if (/^5[1-5]/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'Amex'
  if (/^6/.test(n)) return 'Discover'
  return ''
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

// ─── Component ────────────────────────────────────────────────────────────────

function Checkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Defense-in-depth auth guard (ProtectedRoute already handles this at router level)
  useEffect(() => {
    const token = authTokens.get()
    if (!token || isTokenExpired()) {
      navigate(`/login?redirect=${encodeURIComponent('/checkout' + window.location.search)}`, { replace: true })
    }
  }, [navigate])

  // URL params
  const plan    = searchParams.get('plan') ?? ''
  const annualParam = searchParams.get('annual') === 'true'
  const type    = searchParams.get('type') ?? 'plan'
  const pkg     = searchParams.get('pkg') ?? ''
  const productId = searchParams.get('productId') ?? ''
  const marketplaceAmount = searchParams.get('amount') ?? ''

  // Derived order info
  const orderPlan = PLAN_INFO[plan]
  const creditPack = CREDIT_PACKS[pkg]

  const basePrice: number = (() => {
    if (type === 'credits' && creditPack) return creditPack.price
    if (type === 'marketplace' && marketplaceAmount) return parseFloat(marketplaceAmount) / 100
    if (orderPlan) return annualParam ? orderPlan.annualPrice : orderPlan.monthlyPrice
    return 0
  })()

  const orderDescription: string = (() => {
    if (type === 'credits' && creditPack) return `${creditPack.credits.toLocaleString()} AI Credits`
    if (type === 'marketplace') return `Marketplace item #${productId}`
    if (orderPlan) return `${orderPlan.name} Plan${annualParam ? ' (Annual)' : ' (Monthly)'}`
    return 'Unknown item'
  })()

  // State
  const [step, setStep] = useState<Step>('details')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; label: string } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [country, setCountry] = useState('US')
  const [vatNumber, setVatNumber] = useState('')
  const [vatValid, setVatValid] = useState(false)

  // Card fields
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCVC, setCardCVC] = useState('')
  const [cardName, setCardName] = useState('')
  const [email, setEmail] = useState('')

  const isEU = EU_COUNTRIES.includes(country)
  const vatRate = EU_RATES[country] ?? 0
  const showVAT = isEU && !vatValid

  // Pricing calc
  const subtotal = (() => {
    if (!couponApplied) return basePrice
    if (couponApplied.discount < 1) return basePrice * (1 - couponApplied.discount)
    return Math.max(0, basePrice - couponApplied.discount)
  })()

  const vatAmount = showVAT ? subtotal * vatRate : 0
  const total = subtotal + vatAmount

  const applyCoupon = () => {
    const trimmed = couponCode.trim().toUpperCase()
    const found = COUPON_CODES[trimmed]
    if (found) {
      setCouponApplied({ code: trimmed, ...found })
      setCouponError('')
    } else {
      setCouponApplied(null)
      setCouponError('Invalid coupon code.')
    }
  }

  const handleVatNumberChange = (v: string) => {
    setVatNumber(v)
    // Naive: treat as valid if ≥ 8 chars
    setVatValid(v.trim().length >= 8)
  }

  const handlePay = () => {
    setStep('processing')
    setTimeout(() => setStep('done'), 2000)
  }

  // Reset coupon error when typing
  useEffect(() => { setCouponError('') }, [couponCode])

  const cardBrand = getCardBrand(cardNumber)

  return (
    <div className="checkout-page">
      <div className="container">
        <div className="checkout-layout">
          {/* ── Main form ─────────────────────────────────────── */}
          <div className="checkout-form-card glass-card">

            {/* ── Processing ─── */}
            {step === 'processing' && (
              <div className="checkout-step checkout-step-processing">
                <div className="processing-spinner" />
                <p className="processing-label">Securing your payment…</p>
              </div>
            )}

            {/* ── Done ─── */}
            {step === 'done' && (
              <div className="checkout-step checkout-step-done">
                <div className="success-checkmark">
                  <svg viewBox="0 0 52 52">
                    <circle className="success-circle" cx="26" cy="26" r="25" fill="none" />
                    <path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <h2 className="done-title">Payment successful!</h2>
                <p className="done-sub">
                  Welcome to {type === 'credits' ? `${creditPack?.credits.toLocaleString() ?? ''} AI Credits` : (orderPlan?.name ?? 'your plan')} plan.
                </p>
                <p className="done-invoice">
                  Your invoice will be emailed to <strong>{email || 'your email'}</strong>.
                </p>
                <Link to="/account" className="btn-primary done-cta">Go to Account →</Link>
              </div>
            )}

            {/* ── Step 1: Details ─── */}
            {step === 'details' && (
              <div className="checkout-step">
                <h2 className="checkout-step-title">Order details</h2>

                {/* Email */}
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                {/* Country */}
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <select
                    className="form-input form-select"
                    value={country}
                    onChange={e => { setCountry(e.target.value); setVatNumber(''); setVatValid(false) }}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* EU VAT */}
                {isEU && (
                  <div className="form-group vat-group">
                    <label className="form-label">VAT number <span className="form-label-note">(optional — for B2B)</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. FR12345678901"
                      value={vatNumber}
                      onChange={e => handleVatNumberChange(e.target.value)}
                    />
                    {vatValid && <p className="vat-valid-msg">✓ VAT number valid — zero-rated</p>}
                    {isEU && !vatValid && (
                      <p className="vat-info-msg">VAT ({Math.round(vatRate * 100)}%) will be applied for {COUNTRIES.find(c => c.code === country)?.name}.</p>
                    )}
                  </div>
                )}

                {/* Coupon */}
                <div className="form-group">
                  <label className="form-label">Coupon code</label>
                  <div className="coupon-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional (e.g. LAUNCH50)"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    />
                    <button className="btn-secondary coupon-btn" onClick={applyCoupon}>Apply</button>
                  </div>
                  {couponApplied && <p className="coupon-ok">✓ {couponApplied.label}</p>}
                  {couponError && <p className="coupon-err">✗ {couponError}</p>}
                </div>

                <button className="btn-primary checkout-next-btn" onClick={() => setStep('payment')}>
                  Continue to Payment →
                </button>
              </div>
            )}

            {/* ── Step 2: Payment ─── */}
            {step === 'payment' && (
              <div className="checkout-step">
                <button className="checkout-back-btn" onClick={() => setStep('details')}>
                  ← Back
                </button>
                <h2 className="checkout-step-title">Payment</h2>

                {/* Payment method tabs */}
                <div className="payment-method-tabs">
                  <button
                    className={`payment-tab${paymentMethod === 'card' ? ' active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    💳 Card
                  </button>
                  <button
                    className={`payment-tab${paymentMethod === 'paypal' ? ' active' : ''}`}
                    onClick={() => setPaymentMethod('paypal')}
                  >
                    PayPal
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="card-form">
                    <div className="form-group">
                      <label className="form-label">Card number</label>
                      <div className="card-input-group">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input card-number-input"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                          maxLength={19}
                        />
                        {cardBrand && <span className="card-brand-badge">{cardBrand}</span>}
                      </div>
                    </div>

                    <div className="card-row">
                      <div className="form-group">
                        <label className="form-label">Expiry</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                          maxLength={5}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">CVC</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="123"
                          value={cardCVC}
                          onChange={e => setCardCVC(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          maxLength={4}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Cardholder name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Alex Producer"
                        value={cardName}
                        onChange={e => setCardName(e.target.value)}
                      />
                    </div>

                    <p className="stripe-lockup">🔒 Powered by <strong>Stripe</strong> — your card data is never stored on our servers.</p>
                  </div>
                )}

                {paymentMethod === 'paypal' && (
                  <div className="paypal-section">
                    <div className="paypal-logo">PayPal</div>
                    <p className="paypal-info">You'll be redirected to PayPal to complete your payment securely. After approval, you'll return here automatically.</p>
                  </div>
                )}

                {/* Order total with VAT */}
                <div className="order-total-section">
                  <div className="order-summary-item">
                    <span>{orderDescription}</span>
                    <span>${basePrice.toFixed(2)}</span>
                  </div>
                  {couponApplied && (
                    <div className="order-summary-item order-summary-discount">
                      <span>Coupon ({couponApplied.code})</span>
                      <span>-${(basePrice - subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {showVAT && (
                    <div className="order-summary-item vat-row">
                      <span>VAT ({Math.round(vatRate * 100)}%)</span>
                      <span>${vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="order-summary-item order-total-row">
                    <span>Total due today</span>
                    <span className="order-total-amount">${total.toFixed(2)}</span>
                  </div>
                </div>

                <button className="btn-primary checkout-pay-btn" onClick={handlePay}>
                  Pay ${total.toFixed(2)}
                </button>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <aside className="checkout-sidebar">
            <div className="glass-card checkout-sidebar-card">
              <h3 className="sidebar-title">Order summary</h3>
              <div className="sidebar-item">
                <span className="sidebar-item-name">{orderDescription}</span>
                <span className="sidebar-item-price">${basePrice.toFixed(2)}</span>
              </div>
              {annualParam && type === 'plan' && orderPlan && (
                <div className="sidebar-note">Billed annually</div>
              )}
              {couponApplied && (
                <div className="sidebar-item sidebar-discount">
                  <span>Coupon: {couponApplied.code}</span>
                  <span className="sidebar-discount-amount">-${(basePrice - subtotal).toFixed(2)}</span>
                </div>
              )}
              {showVAT && step === 'payment' && (
                <div className="sidebar-item sidebar-vat">
                  <span>VAT ({Math.round(vatRate * 100)}%)</span>
                  <span>${vatAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="sidebar-divider" />
              <div className="sidebar-total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="sidebar-trust">
                <p>🔒 SSL Encrypted</p>
                <p>↩️ 14-day refund guarantee</p>
                <p>✓ Cancel subscription anytime</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Checkout

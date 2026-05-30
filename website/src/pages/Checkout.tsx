import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authTokens, isTokenExpired, apiGet, apiPost } from '../lib/api'
import './Checkout.css'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

function Checkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionData, setSessionData] = useState<{ planId?: string; type?: string } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe')

  // Auth guard (defense-in-depth — ProtectedRoute already handles this at router level)
  useEffect(() => {
    const token = authTokens.get()
    if (!token || isTokenExpired()) {
      navigate(`/login?redirect=${encodeURIComponent('/checkout' + window.location.search)}`, { replace: true })
    }
  }, [navigate])

  const success = searchParams.get('success') === '1'
  const canceled = searchParams.get('canceled') === '1'
  const sessionId = searchParams.get('session_id') ?? ''

  // PayPal return detection
  const paypalToken = searchParams.get('token')          // order ID for one-time
  const paypalSubscriptionId = searchParams.get('subscription_id')  // for subscriptions
  const paypalPayerId = searchParams.get('PayerID')

  // PayPal order capture state
  const [paypalCaptureState, setPaypalCaptureState] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle')
  const [paypalCaptureError, setPaypalCaptureError] = useState('')

  // Fetch session status on success
  useEffect(() => {
    if (success && sessionId) {
      apiGet<{ success: boolean; planId?: string; type?: string }>(`/api/payments/stripe/session/${sessionId}`)
        .then(data => setSessionData(data))
        .catch(() => {}) // non-critical
    }
  }, [success, sessionId])

  // Auto-capture PayPal order on return
  useEffect(() => {
    if (paypalToken && paypalPayerId && paypalCaptureState === 'idle') {
      setPaypalCaptureState('capturing')
      apiPost<{ success: boolean; invoiceId?: string; status?: string }>(
        '/api/payments/paypal/capture',
        { orderId: paypalToken }
      )
        .then(result => {
          if (result.success) {
            setPaypalCaptureState('done')
          } else {
            setPaypalCaptureState('error')
            setPaypalCaptureError('Capture failed. Please contact support.')
          }
        })
        .catch(e => {
          setPaypalCaptureState('error')
          setPaypalCaptureError(e instanceof Error ? e.message : 'Capture failed')
        })
    }
  }, [paypalToken, paypalPayerId, paypalCaptureState])

  // URL params
  const plan               = searchParams.get('plan') ?? ''
  const type               = searchParams.get('type') ?? 'plan'
  const pkg                = searchParams.get('pkg') ?? ''
  const annual             = searchParams.get('annual') === 'true'
  const productId          = searchParams.get('productId') ?? ''
  const marketplaceAmount  = searchParams.get('amount') ?? ''
  const productName        = searchParams.get('productName') ?? 'Item'

  // Derived order info
  const orderPlan  = PLAN_INFO[plan]
  const creditPack = CREDIT_PACKS[pkg]

  const basePrice: number = (() => {
    if (type === 'credits' && creditPack) return creditPack.price
    if (type === 'marketplace' && marketplaceAmount) return parseFloat(marketplaceAmount) / 100
    if (orderPlan) return annual ? orderPlan.annualPrice : orderPlan.monthlyPrice
    return 0
  })()

  const orderDescription: string = (() => {
    if (type === 'credits' && creditPack) return `${creditPack.credits.toLocaleString()} AI Credits`
    if (type === 'marketplace') return productName
    if (orderPlan) return `${orderPlan.name} Plan${annual ? ' (Annuel)' : ' (Mensuel)'}`
    return 'Unknown item'
  })()

  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = { type, annual, currency: 'usd' }
      if (type === 'plan') body['planId'] = plan
      if (type === 'credits') body['pkg'] = pkg
      if (type === 'marketplace') {
        body['productId'] = productId
        body['productName'] = productName
        body['amountCents'] = parseInt(marketplaceAmount, 10)
      }

      const result = await apiPost<{ success: boolean; url: string; sessionId: string }>(
        '/api/payments/stripe/session',
        body
      )

      if (result.url) {
        window.location.href = result.url // redirect to Stripe Hosted Checkout
      } else {
        setError('Failed to create checkout session. Please try again.')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment initialization failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handlePayPalCheckout() {
    setLoading(true)
    setError('')
    try {
      let approvalUrl: string

      if (type === 'plan' && plan) {
        // Subscription
        const result = await apiPost<{ success: boolean; subscriptionId: string; approvalUrl: string; status: string }>(
          '/api/payments/subscribe',
          {
            planId: plan,
            paymentMethod: 'paypal',
            annual,
          }
        )
        approvalUrl = result.approvalUrl
      } else {
        // One-time purchase (credits or marketplace)
        let amountUSD: string
        let description: string

        if (type === 'credits' && creditPack) {
          amountUSD = creditPack.price.toFixed(2)
          description = `${creditPack.credits} AI Credits`
        } else if (type === 'marketplace' && marketplaceAmount) {
          amountUSD = (parseFloat(marketplaceAmount) / 100).toFixed(2)
          description = productName
        } else {
          setError('Invalid payment parameters')
          setLoading(false)
          return
        }

        const result = await apiPost<{ success: boolean; orderId: string; approvalUrl: string }>(
          '/api/payments/paypal/create-order',
          {
            amountUSD,
            description,
            productType: type,
            country: 'US',
          }
        )
        approvalUrl = result.approvalUrl
      }

      if (approvalUrl) {
        window.location.href = approvalUrl
      } else {
        setError('PayPal checkout unavailable. Please try Stripe.')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'PayPal initialization failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── PayPal capturing screen ───────────────────────────────────────────────────
  if (paypalToken && paypalPayerId && paypalCaptureState === 'capturing') {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-processing">
              <div className="processing-spinner" />
              <p>Confirmation du paiement PayPal...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PayPal order captured successfully ────────────────────────────────────────
  if (paypalToken && paypalPayerId && paypalCaptureState === 'done') {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-success">
              <div className="success-icon">✓</div>
              <h2>Paiement confirmé !</h2>
              <p>Ton abonnement est maintenant actif. Tu peux accéder à toutes les fonctionnalités Neurotek AI.</p>
              <div className="success-actions">
                <a href="/download" className="nt-btn nt-btn-primary btn-primary">Télécharger l'application</a>
                <a href="/billing" className="nt-btn nt-btn-ghost btn-secondary">Voir la facturation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PayPal capture error ──────────────────────────────────────────────────────
  if (paypalToken && paypalPayerId && paypalCaptureState === 'error') {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-canceled">
              <div className="canceled-icon">✕</div>
              <h2>Erreur de paiement PayPal</h2>
              <p>{paypalCaptureError || 'Une erreur est survenue lors de la confirmation du paiement.'}</p>
              <button
                className="nt-btn nt-btn-primary btn-primary"
                onClick={() => navigate(-1)}
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PayPal subscription activated ────────────────────────────────────────────
  if (paypalSubscriptionId && !paypalToken) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-success">
              <div className="success-icon">✓</div>
              <h2>Abonnement PayPal activé !</h2>
              <p>Ton abonnement PayPal est en cours d'activation. Tu recevras une confirmation par email.</p>
              <div className="success-actions">
                <a href="/download" className="nt-btn nt-btn-primary btn-primary">Télécharger l'application</a>
                <a href="/billing" className="nt-btn nt-btn-ghost btn-secondary">Voir la facturation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-success">
              <div className="success-icon">✓</div>
              <h2>Paiement confirmé !</h2>
              <p>Ton abonnement est maintenant actif. Tu peux accéder à toutes les fonctionnalités Neurotek AI.</p>
              {sessionData?.planId && (
                <p className="success-plan">Plan : <strong>{sessionData.planId}</strong></p>
              )}
              <div className="success-actions">
                <a href="/download" className="nt-btn nt-btn-primary btn-primary">Télécharger l'application</a>
                <a href="/billing" className="nt-btn nt-btn-ghost btn-secondary">Voir la facturation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Canceled screen ───────────────────────────────────────────────────────────
  if (canceled) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="checkout-container">
            <div className="checkout-canceled">
              <div className="canceled-icon">✕</div>
              <h2>Paiement annulé</h2>
              <p>Ton paiement n'a pas été complété. Aucun montant n'a été débité.</p>
              <button
                className="nt-btn nt-btn-primary btn-primary"
                onClick={() => navigate(-1)}
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Checkout summary (main state) ─────────────────────────────────────────────
  return (
    <div className="checkout-page">
      <div className="container">
        <div className="checkout-layout">
          {/* ── Main checkout card ─────────────────────────────── */}
          <div className="checkout-form-card glass-card">
            <div className="checkout-step">
              <h2 className="checkout-step-title">Récapitulatif de commande</h2>

              {/* Order detail */}
              <div className="order-total-section">
                <div className="order-summary-item">
                  <span>{orderDescription}</span>
                  <span>{formatPrice(basePrice)}</span>
                </div>
                {annual && type === 'plan' && (
                  <div className="order-summary-item">
                    <span className="form-label-note">Facturation annuelle</span>
                  </div>
                )}
                <div className="order-summary-item order-total-row">
                  <span>Total dû aujourd'hui</span>
                  <span className="order-total-amount">{formatPrice(basePrice)}</span>
                </div>
              </div>

              {/* Payment method toggle */}
              <div className="checkout-method-toggle">
                <button
                  type="button"
                  className={`method-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  💳 Carte bancaire
                </button>
                <button
                  type="button"
                  className={`method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('paypal')}
                >
                  <span className="paypal-text">Pay<span>Pal</span></span>
                </button>
              </div>

              {/* Error */}
              {error && <div className="checkout-error">{error}</div>}

              {/* Pay button — dispatches by payment method */}
              {paymentMethod === 'stripe' ? (
                <button
                  className="btn-primary checkout-pay-btn"
                  onClick={handleCheckout}
                  disabled={loading || basePrice === 0}
                >
                  {loading ? 'Redirection...' : `Payer ${formatPrice(basePrice)} — Stripe 🔒`}
                </button>
              ) : (
                <button
                  className="btn-paypal checkout-pay-btn"
                  onClick={handlePayPalCheckout}
                  disabled={loading || basePrice === 0}
                >
                  {loading ? 'Redirection PayPal...' : `Payer ${formatPrice(basePrice)} avec PayPal`}
                </button>
              )}

              <p className="checkout-stripe-note">
                Paiement sécurisé par Stripe. Vos données bancaires ne transitent jamais par nos serveurs.
              </p>
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <aside className="checkout-sidebar">
            <div className="glass-card checkout-sidebar-card">
              <h3 className="sidebar-title">Résumé</h3>
              <div className="sidebar-item">
                <span className="sidebar-item-name">{orderDescription}</span>
                <span className="sidebar-item-price">{formatPrice(basePrice)}</span>
              </div>
              {annual && type === 'plan' && orderPlan && (
                <div className="sidebar-note">Facturation annuelle</div>
              )}
              <div className="sidebar-divider" />
              <div className="sidebar-total">
                <span>Total</span>
                <span>{formatPrice(basePrice)}</span>
              </div>
              <div className="sidebar-trust">
                <p>🔒 SSL Encrypted</p>
                <p>↩️ Garantie remboursement 14 jours</p>
                <p>✓ Annulez votre abonnement à tout moment</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Checkout

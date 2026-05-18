import Link from 'next/link'

export const metadata = { title: 'Pricing — Neurotek AI' }

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: 'forever',
    features: ['10 AI generations / month', '5 projects', 'Piano Roll', 'Arrangement Timeline', 'Mixer', 'VST support'],
    cta: 'Download Free',
    href: '/download',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '€14.90',
    period: '/ month',
    features: ['200 AI generations / month', 'Unlimited projects', 'Everything in Free', 'Priority AI queue', 'Early access features'],
    cta: 'Get Pro',
    href: '/login',
    highlight: true,
  },
  {
    name: 'Studio',
    price: '€39',
    period: '/ month',
    features: ['Unlimited AI generations', 'Unlimited projects', 'Cloud sync', 'Everything in Pro', 'Dedicated support'],
    cta: 'Get Studio',
    href: '/login',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-24">
      <h1 className="text-4xl font-bold text-center text-nt-text mb-4">Simple Pricing</h1>
      <p className="text-center text-nt-muted mb-16">Start free, upgrade when you need more.</p>
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map(p => (
          <div key={p.name} className={`rounded-2xl p-8 border flex flex-col ${p.highlight ? 'border-nt-purple bg-nt-purple/10' : 'border-nt-border bg-nt-card'}`}>
            <h2 className="text-xl font-bold text-nt-text">{p.name}</h2>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-extrabold text-nt-text">{p.price}</span>
              <span className="text-nt-muted ml-1">{p.period}</span>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {p.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-nt-muted">
                  <span className="text-nt-cyan mt-0.5">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href={p.href} className={`block text-center py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-90 ${p.highlight ? 'bg-nt-purple text-white' : 'border border-nt-border text-nt-text'}`}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

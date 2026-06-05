import { useSubscriptionStore } from '../../store/subscriptionStore'

export default function PremiumBadge() {
  const { plan, isActive, daysRemaining } = useSubscriptionStore()

  if (!isActive || plan === 'free') {
    return (
      <a
        href="https://app.neurotek.ai/pricing"
        target="_blank"
        rel="noreferrer"
        className="sidebar-upgrade-btn"
        title="Upgrade to Pro"
      >
        ⚡ Passer Pro
      </a>
    )
  }

  return (
    <div className={`sidebar-plan-badge ${daysRemaining !== null && daysRemaining <= 7 ? 'expiring' : ''}`}
         title={daysRemaining !== null ? `Expire dans ${daysRemaining}j` : plan}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </div>
  )
}

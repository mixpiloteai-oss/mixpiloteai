import { Link } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

interface PremiumGateProps {
  requiredPlan?: 'pro' | 'studio'
  children: React.ReactNode
  fallback?: React.ReactNode
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, creator: 1, studio: 2, label: 3 }

export default function PremiumGate({ requiredPlan = 'pro', children, fallback }: PremiumGateProps) {
  const { plan, isActive, loading } = useSubscription()

  if (loading) return <>{children}</>  // optimistic while loading

  const userRank = PLAN_RANK[plan] ?? 0
  const requiredRank = PLAN_RANK[requiredPlan] ?? 1
  const hasAccess = isActive && userRank >= requiredRank

  if (hasAccess) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <div className="premium-gate">
      <div className="premium-gate-icon">🔒</div>
      <h3 className="premium-gate-title">Fonctionnalité Premium</h3>
      <p className="premium-gate-desc">
        Cette fonctionnalité nécessite un abonnement{' '}
        <strong>{requiredPlan === 'studio' ? 'Studio' : 'Pro'}</strong> ou supérieur.
      </p>
      <Link to={`/pricing`} className="nt-btn nt-btn-primary">
        Voir les offres →
      </Link>
    </div>
  )
}

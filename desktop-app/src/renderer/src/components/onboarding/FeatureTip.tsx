import { useState } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'

interface FeatureTipProps {
  id: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
}

export default function FeatureTip({ id, title, content, position = 'bottom', children }: FeatureTipProps) {
  const [open, setOpen] = useState(false)
  const { isTipDismissed, dismissTip } = useOnboardingStore()

  if (isTipDismissed(id)) {
    return <>{children}</>
  }

  const panelStyle: React.CSSProperties = {}
  switch (position) {
    case 'top':
      panelStyle.bottom = '100%'
      panelStyle.left = '50%'
      panelStyle.transform = 'translateX(-50%)'
      panelStyle.marginBottom = 8
      break
    case 'left':
      panelStyle.right = '100%'
      panelStyle.top = 0
      panelStyle.marginRight = 8
      break
    case 'right':
      panelStyle.left = '100%'
      panelStyle.top = 0
      panelStyle.marginLeft = 8
      break
    case 'bottom':
    default:
      panelStyle.top = '100%'
      panelStyle.left = '50%'
      panelStyle.transform = 'translateX(-50%)'
      panelStyle.marginTop = 8
      break
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <div
        className="nt-tip-badge"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      />
      {open && (
        <div className="nt-tip-panel" style={panelStyle}>
          <div className="nt-tip-panel-title">{title}</div>
          {content}
          <span
            className="nt-tip-dismiss"
            onClick={(e) => {
              e.stopPropagation()
              dismissTip(id)
              setOpen(false)
            }}
          >
            Ne plus afficher
          </span>
        </div>
      )}
    </div>
  )
}

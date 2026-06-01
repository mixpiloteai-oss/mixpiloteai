import './index.css'
import './styles/premium.css'
import './styles/components.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initAudioEngine } from './audio'
import { initRendererErrorReporter } from './lib/rendererErrorReporter'
import { bootLog } from './lib/bootLogger'

initRendererErrorReporter()
bootLog.step('initRendererErrorReporter')

// Pre-warm singletons (AudioContext is not created until user gesture)
try {
  initAudioEngine()
  bootLog.step('initAudioEngine', 'singletons pre-warmed')
} catch (err) {
  bootLog.error('initAudioEngine failed', err)
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  bootLog.error('#root element not found — cannot mount React')
} else {
  bootLog.step('ReactDOM.createRoot', 'mounting App')
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}


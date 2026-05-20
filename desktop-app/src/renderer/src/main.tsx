import './index.css'
import './styles/premium.css'
import './styles/components.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initAudioEngine } from './audio'
import { initRendererErrorReporter } from './lib/rendererErrorReporter'
initRendererErrorReporter()

// Pre-warm singletons (AudioContext is not created until user gesture)
initAudioEngine()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)


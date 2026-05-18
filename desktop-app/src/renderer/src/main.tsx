import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initAudioEngine } from './audio'

// Pre-warm singletons (AudioContext is not created until user gesture)
initAudioEngine()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


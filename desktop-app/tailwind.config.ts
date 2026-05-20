import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'studio-bg':      '#08080f',
        'studio-surface': '#0c0c18',
        'studio-raised':  '#101020',
        'studio-border':  '#1c1c2e',
        'studio-border-hi': 'rgba(255,255,255,0.10)',
        'studio-purple':  '#7c3aed',
        'studio-purple-hi': '#8b5cf6',
        'studio-violet':  '#a855f7',
        'studio-purple-text': '#a78bfa',
        'studio-cyan':    '#06b6d4',
        'studio-cyan-hi': '#22d3ee',
        'studio-text':    '#e2e8f0',
        'studio-text-hi': '#f8fafc',
        'studio-muted':   '#64748b',
        'studio-dim':     '#475569',
        'studio-green':   '#10b981',
        'studio-amber':   '#f59e0b',
        'studio-red':     '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config

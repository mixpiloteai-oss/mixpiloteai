import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'studio-bg':      '#0a0a0f',
        'studio-surface': '#12121a',
        'studio-border':  '#1e1e2e',
        'studio-purple':  '#7c3aed',
        'studio-cyan':    '#06b6d4',
        'studio-text':    '#e2e8f0',
        'studio-muted':   '#64748b',
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

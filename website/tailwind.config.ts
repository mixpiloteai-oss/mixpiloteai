import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'nt-bg':     '#0a0a0f',
        'nt-card':   '#12121a',
        'nt-border': '#1e1e2e',
        'nt-purple': '#7c3aed',
        'nt-cyan':   '#06b6d4',
        'nt-text':   '#e2e8f0',
        'nt-muted':  '#94a3b8',
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'nt-bg':     '#030307',
        'nt-surface':'#0c0c14',
        'nt-card':   '#0f0f1a',
        'nt-border': '#1c1c2e',
        'nt-purple': '#7c3aed',
        'nt-violet': '#a855f7',
        'nt-cyan':   '#06b6d4',
        'nt-text':   '#f1f5f9',
        'nt-muted':  '#64748b',
        'nt-subtle': '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'hero-glow':    'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(124,58,237,0.28), transparent)',
        'purple-glow':  'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(124,58,237,0.15), transparent)',
        'cyan-glow':    'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(6,182,212,0.12), transparent)',
        'section-fade': 'linear-gradient(180deg, transparent, rgba(124,58,237,0.05) 50%, transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        float:   { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}

export default config

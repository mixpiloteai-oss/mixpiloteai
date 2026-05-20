import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface NavLink { label: string; to: string; visible: boolean }
export interface FooterLink { label: string; href: string; external: boolean }
export interface FooterColumn { title: string; links: FooterLink[] }

export interface SiteConfig {
  navbar: {
    logoText: string; logoHighlight: string
    announcementBar: { show: boolean; text: string; url: string; type: string }
    links: NavLink[]
    primaryCta: { text: string; to: string }
    secondaryCta: { text: string; to: string }
  }
  footer: {
    tagline: string; copyright: string
    social: { github: string; twitter: string; discord: string }
    columns: FooterColumn[]
  }
  branding: {
    appName: string; logoText: string; logoHighlight: string; tagline: string
    logoGradientStart: string; logoGradientEnd: string
  }
  colors: {
    accentPrimary: string; accentSecondary: string
    gradientStart: string; gradientMid: string; gradientEnd: string
  }
  marketing: {
    promotionalBanner: { show: boolean; text: string; url: string; type: string }
    socialProof: { rating: string; count: string; label: string }
    featuredSection: { show: boolean; title: string; subtitle: string }
  }
}

const DEFAULT_CONFIG: SiteConfig = {
  navbar: {
    logoText: 'NeuroTek', logoHighlight: 'AI',
    announcementBar: { show: false, text: '', url: '', type: 'info' },
    links: [
      { label: 'Home', to: '/', visible: true },
      { label: 'Download', to: '/download', visible: true },
      { label: 'Pricing', to: '/pricing', visible: true },
      { label: 'Packs', to: '/marketplace', visible: true },
      { label: 'Changelog', to: '/changelog', visible: true },
      { label: 'Support', to: '/support', visible: true },
      { label: 'Collab', to: '/collaboration', visible: true },
      { label: 'Guide', to: '/get-started', visible: true },
    ],
    primaryCta: { text: 'Download', to: '/download' },
    secondaryCta: { text: 'Sign In', to: '/login' },
  },
  footer: {
    tagline: 'The AI-Powered Music Production Studio. Create professional music faster than ever before.',
    copyright: '© 2025 NeuroTek AI. All rights reserved.',
    social: { github: 'https://github.com/mixpiloteai-oss/mixpiloteai', twitter: '#', discord: 'https://discord.gg/neurotek' },
    columns: [
      { title: 'Product', links: [{ label: 'Features', href: '/', external: false }, { label: 'Download', href: '/download', external: false }, { label: 'Pricing', href: '/pricing', external: false }, { label: 'Changelog', href: '/changelog', external: false }] },
      { title: 'Community', links: [{ label: 'Discord Server', href: 'https://discord.gg/neurotek', external: true }, { label: 'Packs Marketplace', href: '/marketplace', external: false }, { label: 'Merch Store', href: '/merch', external: false }, { label: 'GitHub', href: 'https://github.com/mixpiloteai-oss/mixpiloteai', external: true }] },
      { title: 'Resources', links: [{ label: 'Support', href: '/support', external: false }, { label: 'Documentation', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/wiki', external: true }, { label: 'Release Notes', href: '/changelog', external: false }, { label: 'Issue Tracker', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/issues', external: true }] },
      { title: 'Legal', links: [{ label: 'Privacy Policy', href: '/privacy', external: false }, { label: 'Terms of Use', href: '/terms', external: false }, { label: 'Cookie Policy', href: '/privacy', external: false }, { label: 'Licenses', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/blob/main/LICENSE', external: true }] },
    ],
  },
  branding: { appName: 'NeuroTek AI', logoText: 'NeuroTek', logoHighlight: 'AI', tagline: 'The AI-Powered Music Production Studio', logoGradientStart: '#7c3aed', logoGradientEnd: '#06b6d4' },
  colors: { accentPrimary: '#7c3aed', accentSecondary: '#06b6d4', gradientStart: '#7c3aed', gradientMid: '#a855f7', gradientEnd: '#06b6d4' },
  marketing: {
    promotionalBanner: { show: false, text: '', url: '', type: 'promo' },
    socialProof: { rating: '4.9', count: '12,400', label: 'producers' },
    featuredSection: { show: true, title: 'Featured this week', subtitle: 'Hand-picked by our team' },
  },
}

interface SiteConfigCtx { config: SiteConfig; reload: () => void }
const SiteConfigContext = createContext<SiteConfigCtx>({ config: DEFAULT_CONFIG, reload: () => {} })
export function useSiteConfig() { return useContext(SiteConfigContext) }

function merge(raw: Record<string, unknown>): SiteConfig {
  return {
    navbar:    (raw['navbar']    ?? DEFAULT_CONFIG.navbar)    as SiteConfig['navbar'],
    footer:    (raw['footer']    ?? DEFAULT_CONFIG.footer)    as SiteConfig['footer'],
    branding:  (raw['branding']  ?? DEFAULT_CONFIG.branding)  as SiteConfig['branding'],
    colors:    (raw['colors']    ?? DEFAULT_CONFIG.colors)    as SiteConfig['colors'],
    marketing: (raw['marketing'] ?? DEFAULT_CONFIG.marketing) as SiteConfig['marketing'],
  }
}

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)

  function fetchConfig() {
    import('../lib/api').then(({ apiGet }) => {
      (apiGet as (p: string) => Promise<{ success: boolean; data: Record<string, unknown> }>)('/api/cms/landing')
        .then(res => { if (res.data) setConfig(merge(res.data)) })
        .catch(() => {})
    })
  }

  useEffect(() => {
    fetchConfig()
    const id = setInterval(fetchConfig, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const c = config.colors
    const r = document.documentElement
    r.style.setProperty('--nt-accent-primary',   c.accentPrimary)
    r.style.setProperty('--nt-accent-secondary', c.accentSecondary)
    r.style.setProperty('--nt-gradient-start',   c.gradientStart)
    r.style.setProperty('--nt-gradient-mid',     c.gradientMid)
    r.style.setProperty('--nt-gradient-end',     c.gradientEnd)
  }, [config.colors])

  return <SiteConfigContext.Provider value={{ config, reload: fetchConfig }}>{children}</SiteConfigContext.Provider>
}

/*
  Required Supabase table:

  CREATE TABLE IF NOT EXISTS cms_content (
    section_id TEXT PRIMARY KEY,
    content    JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
  );
*/
import { supabase } from './supabase'
import { logger } from '../utils/logger'

// Default content matching the current hardcoded Landing.tsx data
const DEFAULTS: Record<string, unknown> = {
  hero: {
    badge: 'New — Studio 2.0 is live',
    titleLine1: 'The DAW that',
    titleHighlight: 'thinks.',
    subtitle: 'AI-native music production. Professional tools. Zero compromise.',
    cta1Text: 'Download Free',
    cta1Url: '/download',
    cta2Text: 'Watch Demo',
    socialProof: '4.9 · 12,400 producers',
    guideLink: 'Nouveau ? Commence ici →',
  },
  logos: {
    label: 'Trusted by producers at',
    items: ['Def Jam Studio', 'NeonWave', 'Orbital Lab', 'Phantom Sound', 'Studiohaus', 'Apex Beats'],
  },
  stats: [
    { val: '12,400+', label: 'Producers' },
    { val: '2.4M',    label: 'Projects Created' },
    { val: '98%',     label: 'Uptime SLA' },
    { val: '< 50 ms', label: 'AI Latency' },
  ],
  features: {
    eyebrow: 'Features',
    title: 'Everything you need to',
    highlight: 'produce music',
    desc: 'From AI-generated beats to professional export — one tool, zero compromise.',
    items: [
      { icon: '✦', title: 'AI Assistant',   desc: 'Chat with your DAW. Describe the vibe, get a full arrangement — verse, chorus, bridge — in under 5 seconds.', accent: '#a855f7' },
      { icon: '⬡', title: 'Live Collab',    desc: 'Real-time multi-user sessions with < 50 ms latency. See every cursor, every edit, every tweak — live.', accent: '#06b6d4' },
      { icon: '◈', title: 'Marketplace',    desc: 'Browse 60,000+ loops, presets, and sample packs from top producers. One click to your project.', accent: '#f59e0b' },
      { icon: '⬢', title: 'Export Studio',  desc: 'Render stems, full mixes, or MIDI in WAV 32-bit, FLAC, MP3 320. Mastering-chain included.', accent: '#10b981' },
      { icon: '◎', title: 'Plugin Browser', desc: 'Host VST3, AU, and LV2 plugins natively. Full automation, per-plugin undo, zero buffer overhead.', accent: '#22d3ee' },
      { icon: '⬟', title: 'Local AI',       desc: 'On-device neural models run entirely offline. Your music stays private. No cloud required.', accent: '#a855f7' },
    ],
  },
  how: {
    eyebrow: 'How it works',
    title: 'From idea to track',
    highlight: 'in three steps',
    items: [
      { num: '01', title: 'Open a project',        desc: 'Start blank or pick from 200+ templates. Your canvas loads in under a second.' },
      { num: '02', title: 'Ask the AI',             desc: 'Type or speak: "Build a lo-fi hip-hop beat at 85 BPM with jazzy chords." Done.' },
      { num: '03', title: 'Export professionally', desc: 'Bounce stems, master the mix, distribute directly to Spotify, Apple Music, and more.' },
    ],
  },
  compare: {
    eyebrow: 'Why switch',
    title: 'NeuroTek vs',
    highlight: 'traditional DAWs',
    rows: [
      { feature: 'AI-native composition',   nt: '✓ Built-in',        trad: '✗ Plugin add-on' },
      { feature: 'Real-time collaboration', nt: '✓ < 50 ms',         trad: '✗ File sharing only' },
      { feature: 'On-device AI (offline)',  nt: '✓ Always',          trad: '✗ Cloud-only' },
      { feature: 'Free tier',               nt: '✓ Forever',         trad: '✗ Trial only' },
      { feature: 'Cross-platform',          nt: '✓ Win/Mac/Linux',   trad: '⚠ Usually Win/Mac' },
      { feature: 'Plugin format support',   nt: '✓ VST3/AU/LV2',    trad: '⚠ VST3/AU' },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Simple, transparent',
    highlight: 'pricing',
    desc: 'Start free. Scale when you\'re ready. No hidden fees, ever.',
  },
  cta: {
    title: 'Start making music',
    highlight: 'differently.',
    subtitle: 'Download NeuroTek AI and produce your first track in minutes. Free forever — no credit card required.',
    cta1Text: 'Download Free',
    cta1Url: '/download',
    cta2Text: 'See all plans',
    cta2Url: '/pricing',
  },
  navbar: {
    logoText: 'NeuroTek', logoHighlight: 'AI',
    announcementBar: { show: false, text: '🎉 Studio 2.0 is now live — try it free!', url: '/changelog', type: 'info' },
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
      { title: 'Product', links: [
        { label: 'Features', href: '/', external: false },
        { label: 'Download', href: '/download', external: false },
        { label: 'Pricing', href: '/pricing', external: false },
        { label: 'Changelog', href: '/changelog', external: false },
      ]},
      { title: 'Community', links: [
        { label: 'Discord Server', href: 'https://discord.gg/neurotek', external: true },
        { label: 'Packs Marketplace', href: '/marketplace', external: false },
        { label: 'Merch Store', href: '/merch', external: false },
        { label: 'GitHub', href: 'https://github.com/mixpiloteai-oss/mixpiloteai', external: true },
      ]},
      { title: 'Resources', links: [
        { label: 'Support', href: '/support', external: false },
        { label: 'Documentation', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/wiki', external: true },
        { label: 'Release Notes', href: '/changelog', external: false },
        { label: 'Issue Tracker', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/issues', external: true },
      ]},
      { title: 'Legal', links: [
        { label: 'Privacy Policy', href: '/privacy', external: false },
        { label: 'Terms of Use', href: '/terms', external: false },
        { label: 'Cookie Policy', href: '/privacy', external: false },
        { label: 'Licenses', href: 'https://github.com/mixpiloteai-oss/mixpiloteai/blob/main/LICENSE', external: true },
      ]},
    ],
  },
  branding: {
    appName: 'NeuroTek AI', logoText: 'NeuroTek', logoHighlight: 'AI',
    tagline: 'The AI-Powered Music Production Studio',
    logoGradientStart: '#7c3aed', logoGradientEnd: '#06b6d4',
  },
  colors: {
    accentPrimary: '#7c3aed', accentSecondary: '#06b6d4',
    gradientStart: '#7c3aed', gradientMid: '#a855f7', gradientEnd: '#06b6d4',
  },
  marketing: {
    promotionalBanner: { show: false, text: '🚀 Limited offer: 50% off Pro plan this week!', url: '/pricing', type: 'promo' },
    socialProof: { rating: '4.9', count: '12,400', label: 'producers' },
    featuredSection: { show: true, title: 'Featured this week', subtitle: 'Hand-picked by our team' },
  },
}

let contentStore: Map<string, unknown> = new Map(Object.entries(DEFAULTS))
let lastUpdated = new Date().toISOString()

async function loadFromDb(): Promise<void> {
  if (!supabase) return
  const { data, error } = await (supabase
    .from('cms_content')
    .select('section_id, content, updated_at') as any)
  if (error || !data?.length) return
  for (const row of data as Array<{ section_id: string; content: unknown; updated_at: string }>) {
    contentStore.set(row.section_id, row.content)
    if (row.updated_at > lastUpdated) lastUpdated = row.updated_at
  }
  logger.info(`[cmsManager] loaded ${data.length} sections from Supabase`)
}

async function saveToDb(sectionId: string, content: unknown): Promise<void> {
  if (!supabase) return
  const { error } = await (supabase
    .from('cms_content')
    .upsert({ section_id: sectionId, content, updated_at: new Date().toISOString() }, { onConflict: 'section_id' }) as any)
  if (error) logger.error('[cmsManager] save failed:', { message: error.message })
}

loadFromDb().catch(() => {})

export function getLandingContent(): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of contentStore) result[k] = v
  return result
}

export function getSection(sectionId: string): unknown {
  return contentStore.get(sectionId) ?? DEFAULTS[sectionId] ?? null
}

export function getLastUpdated(): string {
  return lastUpdated
}

export async function updateSection(sectionId: string, content: unknown): Promise<unknown> {
  // Deep merge with existing content for partial updates
  const existing = contentStore.get(sectionId) ?? {}
  const merged = typeof existing === 'object' && !Array.isArray(existing) && typeof content === 'object' && !Array.isArray(content)
    ? { ...(existing as Record<string, unknown>), ...(content as Record<string, unknown>) }
    : content
  contentStore.set(sectionId, merged)
  lastUpdated = new Date().toISOString()
  await saveToDb(sectionId, merged)
  return merged
}

export function getAvailableSections(): string[] {
  return Object.keys(DEFAULTS)
}

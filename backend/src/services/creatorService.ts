// ============================================================
// NEUROTEK AI — Creator Service (in-memory)
// ============================================================

export interface SubscriptionTier {
  id: string
  name: string
  price: number         // USD/month in cents
  perks: string[]
  subscribers: number
}

export interface CreatorProfile {
  id: string
  userId: string
  slug: string
  displayName: string
  bio: string
  avatarUrl: string
  bannerUrl: string
  genres: string[]
  verified: boolean
  totalDownloads: number
  totalRevenue: number      // USD cents
  balance: number           // USD cents (pending payout)
  followers: number
  followedBy: Set<string>
  createdAt: number
  socialLinks: { platform: string; url: string }[]
  subscriptionTiers: SubscriptionTier[]
}

export interface CreatorAnalytics {
  creatorId: string
  period: '7d' | '30d' | '90d'
  totalDownloads: number
  totalRevenue: number
  topProducts: { productId: string; name: string; downloads: number; revenue: number }[]
  downloadsByDay: { date: string; downloads: number }[]
  revenueByDay: { date: string; revenue: number }[]
  newFollowers: number
  conversionRate: number
}

export interface SaleRecord {
  id: string
  productId: string
  productName: string
  creatorId: string
  buyerId: string
  amount: number        // USD cents
  creatorShare: number  // 70%
  platformFee: number   // 30%
  timestamp: number
}

// ── Internal state ───────────────────────────────────────────
const creators = new Map<string, CreatorProfile>()
const creatorsBySlug = new Map<string, string>()   // slug → id
const sales: SaleRecord[] = []
const tierSubscriptions = new Map<string, Set<string>>() // `${creatorId}:${tierId}` → userIds

// ── Seed ─────────────────────────────────────────────────────
export function seedCreators(): void {
  if (creators.size > 0) return

  const now = Date.now()
  const day = 86_400_000

  const seed: Omit<CreatorProfile, 'followedBy'>[] = [
    {
      id: 'cr-001',
      userId: 'usr-001',
      slug: 'dark-collective',
      displayName: 'Dark Collective',
      bio: 'Underground hardtek collective from Lyon, France. We create the kicks that destroy sound systems. 200 BPM is our religion.',
      avatarUrl: '/avatars/dark-collective.jpg',
      bannerUrl: '/banners/dark-collective.jpg',
      genres: ['hardtek', 'mentalcore', 'industrial'],
      verified: true,
      totalDownloads: 24_000,
      totalRevenue: 342_000,
      balance: 18_500,
      followers: 4823,
      createdAt: now - 400 * day,
      socialLinks: [
        { platform: 'soundcloud', url: 'https://soundcloud.com/dark-collective' },
        { platform: 'instagram', url: 'https://instagram.com/dark_collective_tek' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-dc-1', name: 'Fan', price: 500, subscribers: 234,
          perks: ['Early access to new packs', 'Monthly exclusive sample'],
        },
        {
          id: 'tier-dc-2', name: 'Pro Access', price: 1500, subscribers: 89,
          perks: ['All Fan perks', 'Full sample library access', 'Monthly 1-on-1 feedback'],
        },
        {
          id: 'tier-dc-3', name: 'Full Studio', price: 3000, subscribers: 12,
          perks: ['All Pro perks', 'Private Discord', 'Collab opportunity', 'Unreleased tracks'],
        },
      ],
    },
    {
      id: 'cr-002',
      userId: 'usr-002',
      slug: 'synthmaster',
      displayName: 'SynthMaster',
      bio: 'Synthesizer nerd and sound designer for 15 years. I live for that analog warmth. Berlin-based producer specializing in modular and semi-modular synthesis.',
      avatarUrl: '/avatars/synthmaster.jpg',
      bannerUrl: '/banners/synthmaster.jpg',
      genres: ['techno', 'acid', 'psytrance', 'trance'],
      verified: true,
      totalDownloads: 31_500,
      totalRevenue: 489_000,
      balance: 28_200,
      followers: 7654,
      createdAt: now - 600 * day,
      socialLinks: [
        { platform: 'bandcamp', url: 'https://synthmaster.bandcamp.com' },
        { platform: 'youtube', url: 'https://youtube.com/@SynthMasterOfficial' },
        { platform: 'twitter', url: 'https://twitter.com/synthmastertek' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-sm-1', name: 'Fan', price: 400, subscribers: 512,
          perks: ['Exclusive preset drops', 'Behind-the-scenes patches'],
        },
        {
          id: 'tier-sm-2', name: 'Sound Designer', price: 1200, subscribers: 178,
          perks: ['All Fan perks', 'Full preset library', 'Synth patch tutorials'],
        },
        {
          id: 'tier-sm-3', name: 'Modular Studio', price: 2500, subscribers: 34,
          perks: ['All Sound Designer perks', 'Monthly modular patch tutorial', 'Custom preset requests'],
        },
      ],
    },
    {
      id: 'cr-003',
      userId: 'usr-003',
      slug: 'industrialmind',
      displayName: 'IndustrialMind',
      bio: 'Dark industrial techno from the depths of Manchester. All sounds processed through analog hardware. No clean signals allowed.',
      avatarUrl: '/avatars/industrialmind.jpg',
      bannerUrl: '/banners/industrialmind.jpg',
      genres: ['industrial', 'techno', 'noise', 'ebm'],
      verified: false,
      totalDownloads: 12_300,
      totalRevenue: 187_000,
      balance: 9_400,
      followers: 2341,
      createdAt: now - 280 * day,
      socialLinks: [
        { platform: 'soundcloud', url: 'https://soundcloud.com/industrialmind' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-im-1', name: 'Underground', price: 600, subscribers: 89,
          perks: ['Monthly industrial sample pack', 'Exclusive dark presets'],
        },
        {
          id: 'tier-im-2', name: 'Machine Room', price: 2000, subscribers: 23,
          perks: ['All Underground perks', 'Hardware processing sessions', 'Source files'],
        },
      ],
    },
    {
      id: 'cr-004',
      userId: 'usr-004',
      slug: 'retrofuture',
      displayName: 'RetroFuture',
      bio: 'Obsessively sampling vintage drum machines since 2008. If it was made before 1990, I want to sample it. Founder of the Vintage Beats archive.',
      avatarUrl: '/avatars/retrofuture.jpg',
      bannerUrl: '/banners/retrofuture.jpg',
      genres: ['hip-hop', 'jungle', 'dnb', 'breakbeat'],
      verified: true,
      totalDownloads: 29_800,
      totalRevenue: 412_000,
      balance: 22_100,
      followers: 6789,
      createdAt: now - 720 * day,
      socialLinks: [
        { platform: 'bandcamp', url: 'https://retrofuture.bandcamp.com' },
        { platform: 'instagram', url: 'https://instagram.com/retrofuturesamples' },
        { platform: 'patreon', url: 'https://patreon.com/retrofuture' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-rf-1', name: 'Crate Digger', price: 500, subscribers: 423,
          perks: ['Monthly vintage drum machine pack', 'Sample history notes'],
        },
        {
          id: 'tier-rf-2', name: 'Archivist', price: 1500, subscribers: 156,
          perks: ['All Crate Digger perks', 'Full archive access', 'Exclusive hardware recordings'],
        },
        {
          id: 'tier-rf-3', name: 'Collector', price: 4000, subscribers: 8,
          perks: ['All Archivist perks', 'Physical vinyl breaks', 'Private sample requests'],
        },
      ],
    },
    {
      id: 'cr-005',
      userId: 'usr-005',
      slug: 'tribewarrior',
      displayName: 'TribeWarrior',
      bio: 'Forest tekno and tribe music from Barcelona. I travel the world to record authentic percussion and bring it to your DAW. 10+ years in the festival circuit.',
      avatarUrl: '/avatars/tribewarrior.jpg',
      bannerUrl: '/banners/tribewarrior.jpg',
      genres: ['tribe', 'forest-tek', 'organic', 'world-music'],
      verified: true,
      totalDownloads: 14_500,
      totalRevenue: 198_000,
      balance: 11_200,
      followers: 3210,
      createdAt: now - 450 * day,
      socialLinks: [
        { platform: 'soundcloud', url: 'https://soundcloud.com/tribewarrior' },
        { platform: 'youtube', url: 'https://youtube.com/@TribeWarriorMusic' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-tw-1', name: 'Tribe Member', price: 700, subscribers: 167,
          perks: ['Monthly world percussion pack', 'Festival stories newsletter'],
        },
        {
          id: 'tier-tw-2', name: 'Ritual Circle', price: 2200, subscribers: 45,
          perks: ['All Tribe Member perks', 'Full percussion library', 'Zoom Q&A sessions'],
        },
      ],
    },
    {
      id: 'cr-006',
      userId: 'usr-006',
      slug: 'psychacid',
      displayName: 'PsychAcid',
      bio: 'TB-303 collector and acid music obsessive. I own 12 original 303s and have been making acid since 1997. All sequences are recorded live, no quantize.',
      avatarUrl: '/avatars/psychacid.jpg',
      bannerUrl: '/banners/psychacid.jpg',
      genres: ['acid', 'acidcore', 'psytrance', 'trance'],
      verified: true,
      totalDownloads: 18_900,
      totalRevenue: 267_000,
      balance: 14_800,
      followers: 5123,
      createdAt: now - 530 * day,
      socialLinks: [
        { platform: 'soundcloud', url: 'https://soundcloud.com/psychacid303' },
        { platform: 'instagram', url: 'https://instagram.com/psychacid303' },
        { platform: 'twitter', url: 'https://twitter.com/psychacid303' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-pa-1', name: 'Acidhead', price: 400, subscribers: 289,
          perks: ['Monthly 303 sequence pack', 'Acid tuning guides'],
        },
        {
          id: 'tier-pa-2', name: '303 Collector', price: 1800, subscribers: 67,
          perks: ['All Acidhead perks', 'Access to all 12 TB-303 recordings', 'Hardware 303 tutorials'],
        },
      ],
    },
    {
      id: 'cr-007',
      userId: 'usr-007',
      slug: 'livemaster',
      displayName: 'LiveMaster',
      bio: 'Professional live performer and template designer. 200+ gigs across Europe. I design templates that actually work on stage — battle-tested, CPU-optimized.',
      avatarUrl: '/avatars/livemaster.jpg',
      bannerUrl: '/banners/livemaster.jpg',
      genres: ['techno', 'live', 'performance'],
      verified: true,
      totalDownloads: 21_400,
      totalRevenue: 378_000,
      balance: 19_300,
      followers: 5890,
      createdAt: now - 650 * day,
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/livemastertek' },
        { platform: 'youtube', url: 'https://youtube.com/@LiveMasterOfficial' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-lm-1', name: 'Stage Fan', price: 800, subscribers: 312,
          perks: ['Monthly live template', 'Gig preparation guides'],
        },
        {
          id: 'tier-lm-2', name: 'Performance Pro', price: 2500, subscribers: 98,
          perks: ['All Stage Fan perks', 'Full template library', 'CPU optimization tips'],
        },
        {
          id: 'tier-lm-3', name: 'Tour Buddy', price: 5000, subscribers: 7,
          perks: ['All Performance Pro perks', 'Private Zoom live set review', 'Tour preparation calls'],
        },
      ],
    },
    {
      id: 'cr-008',
      userId: 'usr-008',
      slug: 'chillwave',
      displayName: 'ChillWave',
      bio: 'Lo-fi enthusiast and ambient architect from Tokyo. Making music for late nights and early mornings. Samples, templates, and textures for the soulful producer.',
      avatarUrl: '/avatars/chillwave.jpg',
      bannerUrl: '/banners/chillwave.jpg',
      genres: ['lofi', 'ambient', 'chillhop', 'soul'],
      verified: false,
      totalDownloads: 38_200,
      totalRevenue: 521_000,
      balance: 29_700,
      followers: 11_234,
      createdAt: now - 480 * day,
      socialLinks: [
        { platform: 'bandcamp', url: 'https://chillwave.bandcamp.com' },
        { platform: 'instagram', url: 'https://instagram.com/chillwavemusic' },
        { platform: 'youtube', url: 'https://youtube.com/@ChillWaveOfficial' },
        { platform: 'twitter', url: 'https://twitter.com/chillwavemusic' },
      ],
      subscriptionTiers: [
        {
          id: 'tier-cw-1', name: 'Chill Listener', price: 300, subscribers: 876,
          perks: ['Monthly lo-fi sample pack', 'Exclusive ambient textures'],
        },
        {
          id: 'tier-cw-2', name: 'Late Night Producer', price: 1000, subscribers: 345,
          perks: ['All Chill Listener perks', 'Full sample library', 'Template breakdowns'],
        },
        {
          id: 'tier-cw-3', name: 'Inner Circle', price: 2500, subscribers: 56,
          perks: ['All Late Night Producer perks', 'Discord community access', 'Monthly feedback sessions'],
        },
      ],
    },
  ]

  for (const data of seed) {
    const profile: CreatorProfile = { ...data, followedBy: new Set() }
    creators.set(data.id, profile)
    creatorsBySlug.set(data.slug, data.id)
  }
}

// ── Public API ───────────────────────────────────────────────
export function getCreator(id: string): CreatorProfile | null {
  return creators.get(id) ?? null
}

export function getCreatorBySlug(slug: string): CreatorProfile | null {
  const id = creatorsBySlug.get(slug)
  if (!id) return null
  return creators.get(id) ?? null
}

export function listCreators(sort: 'popular' | 'newest' | 'trending' = 'popular'): CreatorProfile[] {
  const list = Array.from(creators.values())
  switch (sort) {
    case 'newest': return list.sort((a, b) => b.createdAt - a.createdAt)
    case 'trending': return list.sort((a, b) => b.totalDownloads - a.totalDownloads)
    default: return list.sort((a, b) => b.followers - a.followers)
  }
}

export function followCreator(
  creatorId: string,
  userId: string
): { following: boolean; followers: number } {
  const c = creators.get(creatorId)
  if (!c) return { following: false, followers: 0 }
  const alreadyFollowing = c.followedBy.has(userId)
  if (alreadyFollowing) {
    c.followedBy.delete(userId)
    c.followers = Math.max(0, c.followers - 1)
  } else {
    c.followedBy.add(userId)
    c.followers += 1
  }
  return { following: !alreadyFollowing, followers: c.followers }
}

function generateDailyData(
  days: number
): { date: string; downloads: number; revenue: number }[] {
  const result: { date: string; downloads: number; revenue: number }[] = []
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    const date = d.toISOString().slice(0, 10)
    result.push({
      date,
      downloads: Math.floor(Math.random() * 80) + 10,
      revenue: Math.floor(Math.random() * 5000) + 200,
    })
  }
  return result
}

export function getAnalytics(creatorId: string, period: '7d' | '30d' | '90d'): CreatorAnalytics {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const daily = generateDailyData(days)
  const totalDownloads = daily.reduce((s, d) => s + d.downloads, 0)
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0)

  return {
    creatorId,
    period,
    totalDownloads,
    totalRevenue,
    topProducts: [
      { productId: 'mp-0001', name: 'Dark Collective Kick Vol.1', downloads: Math.floor(totalDownloads * 0.3), revenue: Math.floor(totalRevenue * 0.25) },
      { productId: 'mp-0002', name: 'Hardtek Festival Template', downloads: Math.floor(totalDownloads * 0.2), revenue: Math.floor(totalRevenue * 0.35) },
      { productId: 'mp-0003', name: 'Sub Bass Toolkit', downloads: Math.floor(totalDownloads * 0.15), revenue: Math.floor(totalRevenue * 0.18) },
    ],
    downloadsByDay: daily.map(({ date, downloads }) => ({ date, downloads })),
    revenueByDay: daily.map(({ date, revenue }) => ({ date, revenue })),
    newFollowers: Math.floor(Math.random() * 50) + 5,
    conversionRate: parseFloat((Math.random() * 0.15 + 0.05).toFixed(3)),
  }
}

export function recordSale(
  productId: string,
  productName: string,
  creatorId: string,
  buyerId: string,
  amount: number
): SaleRecord {
  const creatorShare = Math.floor(amount * 0.7)
  const platformFee = amount - creatorShare
  const record: SaleRecord = {
    id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId,
    productName,
    creatorId,
    buyerId,
    amount,
    creatorShare,
    platformFee,
    timestamp: Date.now(),
  }
  sales.push(record)
  const creator = creators.get(creatorId)
  if (creator) {
    creator.totalRevenue += amount
    creator.balance += creatorShare
    creator.totalDownloads += 1
  }
  return record
}

export function requestPayout(
  creatorId: string
): { amount: number; status: 'requested' } | null {
  const creator = creators.get(creatorId)
  if (!creator || creator.balance <= 0) return null
  const amount = creator.balance
  creator.balance = 0
  return { amount, status: 'requested' }
}

export function subscribeToTier(creatorId: string, tierId: string, userId: string): boolean {
  const creator = creators.get(creatorId)
  if (!creator) return false
  const tier = creator.subscriptionTiers.find((t) => t.id === tierId)
  if (!tier) return false
  const key = `${creatorId}:${tierId}`
  const subs = tierSubscriptions.get(key) ?? new Set<string>()
  if (!subs.has(userId)) {
    subs.add(userId)
    tier.subscribers += 1
    tierSubscriptions.set(key, subs)
  }
  return true
}

export function getTopCreators(limit = 6): CreatorProfile[] {
  return Array.from(creators.values())
    .sort((a, b) => b.totalDownloads - a.totalDownloads)
    .slice(0, limit)
}

export function createCreator(
  data: Omit<CreatorProfile, 'followedBy' | 'createdAt' | 'followers' | 'totalDownloads' | 'totalRevenue' | 'balance'>
): CreatorProfile {
  const creator: CreatorProfile = {
    ...data,
    followedBy: new Set(),
    followers: 0,
    totalDownloads: 0,
    totalRevenue: 0,
    balance: 0,
    createdAt: Date.now(),
  }
  creators.set(creator.id, creator)
  creatorsBySlug.set(creator.slug, creator.id)
  return creator
}

// ── Init ─────────────────────────────────────────────────────
seedCreators()

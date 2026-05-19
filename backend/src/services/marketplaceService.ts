// ============================================================
// NEUROTEK AI — Marketplace Service (in-memory)
// ============================================================

export type ProductCategory =
  | 'kick' | 'hat' | 'snare' | 'perc' | 'preset' | 'template'
  | 'rack' | 'plugin' | 'sample' | 'soundbank' | 'melody' | 'bass'

export type ProductStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface MarketProduct {
  id: string
  slug: string
  name: string
  description: string
  category: ProductCategory
  tags: string[]
  creatorId: string
  creatorName: string
  price: number           // 0 = free
  currency: 'USD'
  fileSize: number        // bytes
  fileUrl: string
  previewUrl: string
  coverUrl: string
  bpm?: number
  key?: string
  sampleCount?: number
  status: ProductStatus
  downloads: number
  likes: number
  likedBy: Set<string>
  commentCount: number
  createdAt: number
  updatedAt: number
  featured: boolean
  trendingScore: number
}

export interface ProductComment {
  id: string
  productId: string
  userId: string
  userName: string
  text: string
  rating: number          // 1–5
  createdAt: number
}

// ── Internal state ───────────────────────────────────────────
const products = new Map<string, MarketProduct>()
const comments = new Map<string, ProductComment[]>()
let productIdCounter = 1

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeId(): string {
  return `mp-${String(productIdCounter++).padStart(4, '0')}`
}

// ── Seed data ────────────────────────────────────────────────
export function seedProducts(): void {
  if (products.size > 0) return

  const now = Date.now()
  const day = 86_400_000

  const seed: Omit<MarketProduct, 'id' | 'slug' | 'likedBy' | 'trendingScore'>[] = [
    // KICKS
    {
      name: 'Dark Collective Kick Vol.1',
      description: 'Ultra-punchy hardtek and mentalcore kicks, tuned at 0, +3, +6 semitones. 808-inspired with distorted transients.',
      category: 'kick', tags: ['hardtek', 'mentalcore', 'dark', '808', 'transient'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 0, currency: 'USD', fileSize: 18_500_000,
      fileUrl: '/uploads/dark-collective-kick-vol1.zip',
      previewUrl: '/previews/dark-collective-kick-vol1.mp3',
      coverUrl: '/covers/dark-collective-kick-vol1.jpg',
      bpm: 200, sampleCount: 48,
      status: 'approved', downloads: 4823, likes: 921, commentCount: 134,
      createdAt: now - 45 * day, updatedAt: now - 2 * day, featured: true,
    },
    {
      name: 'Dark Collective Kick Vol.2',
      description: 'Second volume of iconic Dark Collective kicks — deeper sub, rawer compression.',
      category: 'kick', tags: ['hardtek', 'mentalcore', 'sub', 'raw'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 499, currency: 'USD', fileSize: 22_100_000,
      fileUrl: '/uploads/dark-collective-kick-vol2.zip',
      previewUrl: '/previews/dark-collective-kick-vol2.mp3',
      coverUrl: '/covers/dark-collective-kick-vol2.jpg',
      bpm: 200, sampleCount: 64,
      status: 'approved', downloads: 2341, likes: 512, commentCount: 78,
      createdAt: now - 30 * day, updatedAt: now - 1 * day, featured: false,
    },
    {
      name: 'Industrial Kick Bundle',
      description: 'Heavy metal-influenced kicks for industrial techno — clicky, distorted, brutal.',
      category: 'kick', tags: ['industrial', 'techno', 'metal', 'brutal'],
      creatorId: 'cr-003', creatorName: 'IndustrialMind',
      price: 999, currency: 'USD', fileSize: 31_200_000,
      fileUrl: '/uploads/industrial-kick-bundle.zip',
      previewUrl: '/previews/industrial-kick-bundle.mp3',
      coverUrl: '/covers/industrial-kick-bundle.jpg',
      bpm: 150, sampleCount: 72,
      status: 'approved', downloads: 1654, likes: 389, commentCount: 56,
      createdAt: now - 20 * day, updatedAt: now - 3 * day, featured: false,
    },
    // HATS
    {
      name: 'Crispy Hi-Hat Collection',
      description: '120 open and closed hi-hats covering house, techno, and hybrid styles.',
      category: 'hat', tags: ['house', 'techno', 'crispy', 'hihat'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 299, currency: 'USD', fileSize: 9_800_000,
      fileUrl: '/uploads/crispy-hihat-collection.zip',
      previewUrl: '/previews/crispy-hihat-collection.mp3',
      coverUrl: '/covers/crispy-hihat-collection.jpg',
      sampleCount: 120,
      status: 'approved', downloads: 3201, likes: 644, commentCount: 89,
      createdAt: now - 60 * day, updatedAt: now - 5 * day, featured: true,
    },
    {
      name: 'Tribe Tribal Hats',
      description: 'Organic hand percussion-derived hi-hat textures for tribe and forest tek.',
      category: 'hat', tags: ['tribe', 'organic', 'forest', 'percussion'],
      creatorId: 'cr-005', creatorName: 'TribeWarrior',
      price: 0, currency: 'USD', fileSize: 7_400_000,
      fileUrl: '/uploads/tribe-tribal-hats.zip',
      previewUrl: '/previews/tribe-tribal-hats.mp3',
      coverUrl: '/covers/tribe-tribal-hats.jpg',
      sampleCount: 88,
      status: 'approved', downloads: 2890, likes: 543, commentCount: 67,
      createdAt: now - 50 * day, updatedAt: now - 4 * day, featured: false,
    },
    // SNARES
    {
      name: 'Hardtek Snare Arsenal',
      description: 'Punishing snare collection for 200 BPM tekno — compressed, reverbed, dry versions included.',
      category: 'snare', tags: ['hardtek', 'tekno', 'reverb', 'compressed'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 799, currency: 'USD', fileSize: 12_300_000,
      fileUrl: '/uploads/hardtek-snare-arsenal.zip',
      previewUrl: '/previews/hardtek-snare-arsenal.mp3',
      coverUrl: '/covers/hardtek-snare-arsenal.jpg',
      bpm: 200, sampleCount: 56,
      status: 'approved', downloads: 2145, likes: 478, commentCount: 72,
      createdAt: now - 35 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Electronic Snare Pack',
      description: 'Classic electronic snares from 80s TR-909 and 808 lineage, resampled and modernized.',
      category: 'snare', tags: ['909', '808', 'electronic', 'classic', 'vintage'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 0, currency: 'USD', fileSize: 8_100_000,
      fileUrl: '/uploads/electronic-snare-pack.zip',
      previewUrl: '/previews/electronic-snare-pack.mp3',
      coverUrl: '/covers/electronic-snare-pack.jpg',
      sampleCount: 40,
      status: 'approved', downloads: 5432, likes: 1102, commentCount: 198,
      createdAt: now - 90 * day, updatedAt: now - 10 * day, featured: true,
    },
    // PERC
    {
      name: 'Tribal Percussion Library',
      description: 'Recorded tribal and world percussion — djembe, conga, shaker, tambourine, more.',
      category: 'perc', tags: ['tribal', 'world', 'djembe', 'organic'],
      creatorId: 'cr-005', creatorName: 'TribeWarrior',
      price: 1499, currency: 'USD', fileSize: 58_000_000,
      fileUrl: '/uploads/tribal-percussion-library.zip',
      previewUrl: '/previews/tribal-percussion-library.mp3',
      coverUrl: '/covers/tribal-percussion-library.jpg',
      sampleCount: 340,
      status: 'approved', downloads: 987, likes: 267, commentCount: 43,
      createdAt: now - 25 * day, updatedAt: now - 6 * day, featured: false,
    },
    {
      name: 'Acid Clap & Perc Set',
      description: 'Acidcore claps, rim shots, and miscellaneous percussion to complement 303 lines.',
      category: 'perc', tags: ['acidcore', 'clap', 'rim', '303'],
      creatorId: 'cr-006', creatorName: 'PsychAcid',
      price: 0, currency: 'USD', fileSize: 5_600_000,
      fileUrl: '/uploads/acid-clap-perc-set.zip',
      previewUrl: '/previews/acid-clap-perc-set.mp3',
      coverUrl: '/covers/acid-clap-perc-set.jpg',
      sampleCount: 55,
      status: 'approved', downloads: 3456, likes: 712, commentCount: 105,
      createdAt: now - 40 * day, updatedAt: now - 3 * day, featured: false,
    },
    // PRESETS
    {
      name: 'SynthMaster Classic 303',
      description: '48 handcrafted 303-style acid presets for synths like Diva, Dark Energy, Monologue.',
      category: 'preset', tags: ['303', 'acid', 'synth', 'diva', 'monologue'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 1999, currency: 'USD', fileSize: 1_200_000,
      fileUrl: '/uploads/synthmaster-classic-303.zip',
      previewUrl: '/previews/synthmaster-classic-303.mp3',
      coverUrl: '/covers/synthmaster-classic-303.jpg',
      sampleCount: 48,
      status: 'approved', downloads: 6789, likes: 1543, commentCount: 287,
      createdAt: now - 120 * day, updatedAt: now - 1 * day, featured: true,
    },
    {
      name: 'SynthMaster Hypno Bass',
      description: 'Deep hypnotic bass presets for tekno and trance — 32 patches.',
      category: 'preset', tags: ['bass', 'hypno', 'tekno', 'trance', 'deep'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 1499, currency: 'USD', fileSize: 890_000,
      fileUrl: '/uploads/synthmaster-hypno-bass.zip',
      previewUrl: '/previews/synthmaster-hypno-bass.mp3',
      coverUrl: '/covers/synthmaster-hypno-bass.jpg',
      sampleCount: 32,
      status: 'approved', downloads: 3214, likes: 789, commentCount: 134,
      createdAt: now - 80 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Industrial Synth Patches',
      description: 'Harsh, metallic synthesizer patches for industrial techno — 40 patches for Serum & Massive.',
      category: 'preset', tags: ['industrial', 'harsh', 'serum', 'massive', 'metallic'],
      creatorId: 'cr-003', creatorName: 'IndustrialMind',
      price: 999, currency: 'USD', fileSize: 750_000,
      fileUrl: '/uploads/industrial-synth-patches.zip',
      previewUrl: '/previews/industrial-synth-patches.mp3',
      coverUrl: '/covers/industrial-synth-patches.jpg',
      sampleCount: 40,
      status: 'approved', downloads: 1876, likes: 421, commentCount: 67,
      createdAt: now - 55 * day, updatedAt: now - 4 * day, featured: false,
    },
    // TEMPLATES
    {
      name: 'Techno Master Template',
      description: 'Full production-ready techno session template: arrangement, drums, fx chains, master bus.',
      category: 'template', tags: ['techno', 'template', 'arrangement', 'master'],
      creatorId: 'cr-007', creatorName: 'LiveMaster',
      price: 2999, currency: 'USD', fileSize: 45_000_000,
      fileUrl: '/uploads/techno-master-template.zip',
      previewUrl: '/previews/techno-master-template.mp3',
      coverUrl: '/covers/techno-master-template.jpg',
      bpm: 135,
      status: 'approved', downloads: 1234, likes: 321, commentCount: 78,
      createdAt: now - 15 * day, updatedAt: now - 1 * day, featured: true,
    },
    {
      name: 'Trap Bounce Template',
      description: 'Bouncy modern trap template — 808s, hi-hat rolls, melodic lead, full mix.',
      category: 'template', tags: ['trap', 'bounce', '808', 'hihat', 'melodic'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 1999, currency: 'USD', fileSize: 38_000_000,
      fileUrl: '/uploads/trap-bounce-template.zip',
      previewUrl: '/previews/trap-bounce-template.mp3',
      coverUrl: '/covers/trap-bounce-template.jpg',
      bpm: 140, key: 'Am',
      status: 'approved', downloads: 2789, likes: 634, commentCount: 112,
      createdAt: now - 28 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Lo-Fi Study Session Template',
      description: 'Chill lo-fi hip hop template with tape saturation, vinyl crackle, jazzy chords.',
      category: 'template', tags: ['lofi', 'hiphop', 'chill', 'jazz', 'vinyl'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 0, currency: 'USD', fileSize: 28_000_000,
      fileUrl: '/uploads/lofi-study-session-template.zip',
      previewUrl: '/previews/lofi-study-session-template.mp3',
      coverUrl: '/covers/lofi-study-session-template.jpg',
      bpm: 75, key: 'Fm',
      status: 'approved', downloads: 8934, likes: 2341, commentCount: 456,
      createdAt: now - 100 * day, updatedAt: now - 5 * day, featured: true,
    },
    {
      name: 'Hardtek Festival Template',
      description: 'Ready-to-play hardtek festival template, mastered for outdoor sound systems.',
      category: 'template', tags: ['hardtek', 'festival', 'outdoor', 'master'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 3499, currency: 'USD', fileSize: 52_000_000,
      fileUrl: '/uploads/hardtek-festival-template.zip',
      previewUrl: '/previews/hardtek-festival-template.mp3',
      coverUrl: '/covers/hardtek-festival-template.jpg',
      bpm: 200,
      status: 'approved', downloads: 876, likes: 234, commentCount: 45,
      createdAt: now - 10 * day, updatedAt: now - 1 * day, featured: false,
    },
    // RACKS
    {
      name: 'Mastering FX Rack Pro',
      description: 'Professional mastering rack: EQ, compression, limiting, stereo imaging, loudness meter.',
      category: 'rack', tags: ['mastering', 'eq', 'compression', 'limiting', 'pro'],
      creatorId: 'cr-007', creatorName: 'LiveMaster',
      price: 1999, currency: 'USD', fileSize: 2_100_000,
      fileUrl: '/uploads/mastering-fx-rack-pro.zip',
      previewUrl: '/previews/mastering-fx-rack-pro.mp3',
      coverUrl: '/covers/mastering-fx-rack-pro.jpg',
      status: 'approved', downloads: 4521, likes: 1023, commentCount: 187,
      createdAt: now - 70 * day, updatedAt: now - 3 * day, featured: true,
    },
    {
      name: 'Acid Bass Distortion Rack',
      description: 'Destructive distortion rack for acid bass — 6 distortion stages, resonant filter, tube saturation.',
      category: 'rack', tags: ['acid', 'bass', 'distortion', 'saturation', 'filter'],
      creatorId: 'cr-006', creatorName: 'PsychAcid',
      price: 0, currency: 'USD', fileSize: 980_000,
      fileUrl: '/uploads/acid-bass-distortion-rack.zip',
      previewUrl: '/previews/acid-bass-distortion-rack.mp3',
      coverUrl: '/covers/acid-bass-distortion-rack.jpg',
      status: 'approved', downloads: 5678, likes: 1234, commentCount: 234,
      createdAt: now - 85 * day, updatedAt: now - 6 * day, featured: false,
    },
    {
      name: 'Reverb & Space Designer Kit',
      description: 'Convolution reverb presets + algorithmic reverb racks. 30+ spaces: rooms, halls, plates.',
      category: 'rack', tags: ['reverb', 'convolution', 'space', 'hall', 'plate'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 799, currency: 'USD', fileSize: 45_000_000,
      fileUrl: '/uploads/reverb-space-designer-kit.zip',
      previewUrl: '/previews/reverb-space-designer-kit.mp3',
      coverUrl: '/covers/reverb-space-designer-kit.jpg',
      status: 'approved', downloads: 2890, likes: 654, commentCount: 98,
      createdAt: now - 42 * day, updatedAt: now - 4 * day, featured: false,
    },
    // SAMPLE
    {
      name: 'Vinyl Breaks & Loops',
      description: '200 classic breakbeat loops sampled from vinyl records — legally cleared.',
      category: 'sample', tags: ['vinyl', 'breaks', 'loops', 'breakbeat', 'cleared'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 1999, currency: 'USD', fileSize: 120_000_000,
      fileUrl: '/uploads/vinyl-breaks-loops.zip',
      previewUrl: '/previews/vinyl-breaks-loops.mp3',
      coverUrl: '/covers/vinyl-breaks-loops.jpg',
      bpm: 120, sampleCount: 200,
      status: 'approved', downloads: 3456, likes: 876, commentCount: 145,
      createdAt: now - 65 * day, updatedAt: now - 7 * day, featured: false,
    },
    {
      name: 'Orchestral Stabs & Hits',
      description: 'Live-recorded orchestral stabs, brass hits, string swells — 150 samples.',
      category: 'sample', tags: ['orchestral', 'brass', 'strings', 'stabs', 'live'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 2999, currency: 'USD', fileSize: 95_000_000,
      fileUrl: '/uploads/orchestral-stabs-hits.zip',
      previewUrl: '/previews/orchestral-stabs-hits.mp3',
      coverUrl: '/covers/orchestral-stabs-hits.jpg',
      sampleCount: 150,
      status: 'approved', downloads: 1234, likes: 356, commentCount: 67,
      createdAt: now - 38 * day, updatedAt: now - 5 * day, featured: false,
    },
    {
      name: 'Ambient Texture Palette',
      description: 'Evolving ambient textures, drones, and field recordings. Perfect for pads and FX layers.',
      category: 'sample', tags: ['ambient', 'texture', 'drone', 'field', 'pad'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 0, currency: 'USD', fileSize: 67_000_000,
      fileUrl: '/uploads/ambient-texture-palette.zip',
      previewUrl: '/previews/ambient-texture-palette.mp3',
      coverUrl: '/covers/ambient-texture-palette.jpg',
      sampleCount: 80,
      status: 'approved', downloads: 7654, likes: 1987, commentCount: 312,
      createdAt: now - 110 * day, updatedAt: now - 8 * day, featured: true,
    },
    // SOUNDBANK
    {
      name: 'Hardtek Full Soundbank',
      description: 'Complete hardtek soundbank: 300+ samples across kicks, percs, hats, FX, and bass.',
      category: 'soundbank', tags: ['hardtek', 'complete', 'full', 'bundle'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 4999, currency: 'USD', fileSize: 280_000_000,
      fileUrl: '/uploads/hardtek-full-soundbank.zip',
      previewUrl: '/previews/hardtek-full-soundbank.mp3',
      coverUrl: '/covers/hardtek-full-soundbank.jpg',
      bpm: 200, sampleCount: 320,
      status: 'approved', downloads: 2341, likes: 678, commentCount: 134,
      createdAt: now - 18 * day, updatedAt: now - 1 * day, featured: true,
    },
    {
      name: 'Lo-Fi Soundbank Vol.1',
      description: 'Warm, dusty lo-fi sounds: drums, keys, bass, FX. Inspired by MPC golden era.',
      category: 'soundbank', tags: ['lofi', 'mpc', 'warm', 'dusty', 'hip-hop'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 1999, currency: 'USD', fileSize: 145_000_000,
      fileUrl: '/uploads/lofi-soundbank-vol1.zip',
      previewUrl: '/previews/lofi-soundbank-vol1.mp3',
      coverUrl: '/covers/lofi-soundbank-vol1.jpg',
      sampleCount: 210,
      status: 'approved', downloads: 4321, likes: 1098, commentCount: 189,
      createdAt: now - 75 * day, updatedAt: now - 6 * day, featured: false,
    },
    {
      name: 'Trance & Psytrance Bundle',
      description: 'Comprehensive psytrance and progressive trance soundbank — synths, bass, FX, drums.',
      category: 'soundbank', tags: ['psytrance', 'trance', 'progressive', 'bundle'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 3499, currency: 'USD', fileSize: 198_000_000,
      fileUrl: '/uploads/trance-psytrance-bundle.zip',
      previewUrl: '/previews/trance-psytrance-bundle.mp3',
      coverUrl: '/covers/trance-psytrance-bundle.jpg',
      bpm: 148, sampleCount: 280,
      status: 'approved', downloads: 1789, likes: 456, commentCount: 89,
      createdAt: now - 32 * day, updatedAt: now - 3 * day, featured: false,
    },
    // MELODY
    {
      name: 'Acid Melody Loops',
      description: '80 acid melody loops in various keys — 303-style sequences, arpeggios, and leads.',
      category: 'melody', tags: ['acid', 'loops', 'arpeggio', 'lead', '303'],
      creatorId: 'cr-006', creatorName: 'PsychAcid',
      price: 799, currency: 'USD', fileSize: 34_000_000,
      fileUrl: '/uploads/acid-melody-loops.zip',
      previewUrl: '/previews/acid-melody-loops.mp3',
      coverUrl: '/covers/acid-melody-loops.jpg',
      bpm: 135, sampleCount: 80,
      status: 'approved', downloads: 3214, likes: 723, commentCount: 123,
      createdAt: now - 48 * day, updatedAt: now - 4 * day, featured: false,
    },
    {
      name: 'Emotional Piano Phrases',
      description: 'Heartfelt piano phrases for lo-fi, soul, and R&B — 60 loops in minor and major.',
      category: 'melody', tags: ['piano', 'emotional', 'soul', 'rnb', 'lofi'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 1499, currency: 'USD', fileSize: 42_000_000,
      fileUrl: '/uploads/emotional-piano-phrases.zip',
      previewUrl: '/previews/emotional-piano-phrases.mp3',
      coverUrl: '/covers/emotional-piano-phrases.jpg',
      bpm: 80, key: 'Cm', sampleCount: 60,
      status: 'approved', downloads: 5678, likes: 1456, commentCount: 267,
      createdAt: now - 92 * day, updatedAt: now - 9 * day, featured: true,
    },
    {
      name: 'Techno Lead Sequences',
      description: '50 modular-style techno lead sequences — alien, hypnotic, industrial motifs.',
      category: 'melody', tags: ['techno', 'modular', 'lead', 'sequence', 'alien'],
      creatorId: 'cr-003', creatorName: 'IndustrialMind',
      price: 0, currency: 'USD', fileSize: 18_000_000,
      fileUrl: '/uploads/techno-lead-sequences.zip',
      previewUrl: '/previews/techno-lead-sequences.mp3',
      coverUrl: '/covers/techno-lead-sequences.jpg',
      bpm: 140, sampleCount: 50,
      status: 'approved', downloads: 4567, likes: 987, commentCount: 178,
      createdAt: now - 58 * day, updatedAt: now - 5 * day, featured: false,
    },
    // BASS
    {
      name: 'Sub Bass Toolkit',
      description: '60 sub bass one-shots and loops — deep rumble at 40-80Hz, no distortion.',
      category: 'bass', tags: ['sub', 'bass', 'deep', '808', 'rumble'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 699, currency: 'USD', fileSize: 22_000_000,
      fileUrl: '/uploads/sub-bass-toolkit.zip',
      previewUrl: '/previews/sub-bass-toolkit.mp3',
      coverUrl: '/covers/sub-bass-toolkit.jpg',
      sampleCount: 60,
      status: 'approved', downloads: 3890, likes: 867, commentCount: 145,
      createdAt: now - 55 * day, updatedAt: now - 3 * day, featured: false,
    },
    {
      name: 'Acid Bass Sequences Vol.2',
      description: 'Advanced 303 bass sequences for psytrance and acidcore — 70 wet + 70 dry loops.',
      category: 'bass', tags: ['acid', '303', 'psytrance', 'acidcore', 'bass'],
      creatorId: 'cr-006', creatorName: 'PsychAcid',
      price: 1299, currency: 'USD', fileSize: 56_000_000,
      fileUrl: '/uploads/acid-bass-sequences-vol2.zip',
      previewUrl: '/previews/acid-bass-sequences-vol2.mp3',
      coverUrl: '/covers/acid-bass-sequences-vol2.jpg',
      bpm: 148, sampleCount: 140,
      status: 'approved', downloads: 2145, likes: 543, commentCount: 87,
      createdAt: now - 22 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Neuro Bass FX Pack',
      description: 'Neurohop-style modulated bass FX — wobble, growl, reese, and formant patches.',
      category: 'bass', tags: ['neuro', 'wobble', 'growl', 'reese', 'formant'],
      creatorId: 'cr-003', creatorName: 'IndustrialMind',
      price: 1999, currency: 'USD', fileSize: 31_000_000,
      fileUrl: '/uploads/neuro-bass-fx-pack.zip',
      previewUrl: '/previews/neuro-bass-fx-pack.mp3',
      coverUrl: '/covers/neuro-bass-fx-pack.jpg',
      sampleCount: 90,
      status: 'approved', downloads: 1678, likes: 412, commentCount: 76,
      createdAt: now - 17 * day, updatedAt: now - 1 * day, featured: false,
    },
    // PLUGIN
    {
      name: 'MIDI Chord Generator Scripts',
      description: 'DAW-agnostic MIDI scripts for auto-generating chord progressions in 12 modes.',
      category: 'plugin', tags: ['midi', 'chord', 'generator', 'script', 'mode'],
      creatorId: 'cr-007', creatorName: 'LiveMaster',
      price: 2499, currency: 'USD', fileSize: 3_200_000,
      fileUrl: '/uploads/midi-chord-generator-scripts.zip',
      previewUrl: '/previews/midi-chord-generator-scripts.mp3',
      coverUrl: '/covers/midi-chord-generator-scripts.jpg',
      status: 'approved', downloads: 1987, likes: 521, commentCount: 98,
      createdAt: now - 44 * day, updatedAt: now - 4 * day, featured: false,
    },
    {
      name: 'Euclidean Rhythm Generator',
      description: 'Max for Live euclidean rhythm device — up to 16 voices, probabilistic trigger, evolving patterns.',
      category: 'plugin', tags: ['euclidean', 'rhythm', 'max4live', 'generative', 'probability'],
      creatorId: 'cr-007', creatorName: 'LiveMaster',
      price: 1499, currency: 'USD', fileSize: 1_800_000,
      fileUrl: '/uploads/euclidean-rhythm-generator.zip',
      previewUrl: '/previews/euclidean-rhythm-generator.mp3',
      coverUrl: '/covers/euclidean-rhythm-generator.jpg',
      status: 'approved', downloads: 3456, likes: 876, commentCount: 145,
      createdAt: now - 67 * day, updatedAt: now - 6 * day, featured: false,
    },
    // Additional products to reach 40+
    {
      name: 'Kick + Sub Layering Rack',
      description: 'Rack for perfectly blending kick and sub bass — phase alignment, transient shaping, parallel saturation.',
      category: 'rack', tags: ['kick', 'sub', 'layer', 'phase', 'transient'],
      creatorId: 'cr-001', creatorName: 'Dark Collective',
      price: 499, currency: 'USD', fileSize: 780_000,
      fileUrl: '/uploads/kick-sub-layering-rack.zip',
      previewUrl: '/previews/kick-sub-layering-rack.mp3',
      coverUrl: '/covers/kick-sub-layering-rack.jpg',
      status: 'approved', downloads: 6789, likes: 1543, commentCount: 289,
      createdAt: now - 88 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Vintage Drum Machine Kit',
      description: 'Meticulously sampled LinnDrum, Oberheim DMX, Roland CR-78 — 3 machines, 200+ samples.',
      category: 'sample', tags: ['vintage', 'drum-machine', 'linndrum', 'oberheim', 'cr78'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 2499, currency: 'USD', fileSize: 78_000_000,
      fileUrl: '/uploads/vintage-drum-machine-kit.zip',
      previewUrl: '/previews/vintage-drum-machine-kit.mp3',
      coverUrl: '/covers/vintage-drum-machine-kit.jpg',
      sampleCount: 240,
      status: 'approved', downloads: 2345, likes: 589, commentCount: 98,
      createdAt: now - 55 * day, updatedAt: now - 5 * day, featured: false,
    },
    {
      name: 'DnB & Jungle Breaks Pack',
      description: 'Essential drum & bass and jungle break patterns — amen, think, funky drummer, and more.',
      category: 'sample', tags: ['dnb', 'jungle', 'breaks', 'amen', 'drumloop'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 0, currency: 'USD', fileSize: 43_000_000,
      fileUrl: '/uploads/dnb-jungle-breaks-pack.zip',
      previewUrl: '/previews/dnb-jungle-breaks-pack.mp3',
      coverUrl: '/covers/dnb-jungle-breaks-pack.jpg',
      bpm: 170, sampleCount: 90,
      status: 'approved', downloads: 9123, likes: 2234, commentCount: 412,
      createdAt: now - 130 * day, updatedAt: now - 12 * day, featured: true,
    },
    {
      name: 'Xfer Serum Bass Presets',
      description: '60 high-energy bass presets for Xfer Serum — dubstep, neuro, hybrid bass.',
      category: 'preset', tags: ['serum', 'bass', 'dubstep', 'neuro', 'xfer'],
      creatorId: 'cr-003', creatorName: 'IndustrialMind',
      price: 1799, currency: 'USD', fileSize: 1_400_000,
      fileUrl: '/uploads/xfer-serum-bass-presets.zip',
      previewUrl: '/previews/xfer-serum-bass-presets.mp3',
      coverUrl: '/covers/xfer-serum-bass-presets.jpg',
      sampleCount: 60,
      status: 'approved', downloads: 4321, likes: 987, commentCount: 167,
      createdAt: now - 44 * day, updatedAt: now - 3 * day, featured: false,
    },
    {
      name: 'Future Garage Template',
      description: 'UK garage-infused future bass template — shuffle grooves, pitched vocals, lush pads.',
      category: 'template', tags: ['garage', 'future-bass', 'uk', 'shuffle', 'vocals'],
      creatorId: 'cr-008', creatorName: 'ChillWave',
      price: 1499, currency: 'USD', fileSize: 35_000_000,
      fileUrl: '/uploads/future-garage-template.zip',
      previewUrl: '/previews/future-garage-template.mp3',
      coverUrl: '/covers/future-garage-template.jpg',
      bpm: 132, key: 'Bb',
      status: 'approved', downloads: 3210, likes: 789, commentCount: 134,
      createdAt: now - 36 * day, updatedAt: now - 2 * day, featured: false,
    },
    {
      name: 'Minimal Techno Toolkit',
      description: 'Berlin-style minimal techno toolkit — stripped-down drums, hypnotic percs, subtle textures.',
      category: 'soundbank', tags: ['minimal', 'techno', 'berlin', 'hypnotic', 'stripped'],
      creatorId: 'cr-002', creatorName: 'SynthMaster',
      price: 2499, currency: 'USD', fileSize: 134_000_000,
      fileUrl: '/uploads/minimal-techno-toolkit.zip',
      previewUrl: '/previews/minimal-techno-toolkit.mp3',
      coverUrl: '/covers/minimal-techno-toolkit.jpg',
      bpm: 130, sampleCount: 180,
      status: 'approved', downloads: 2890, likes: 712, commentCount: 123,
      createdAt: now - 62 * day, updatedAt: now - 5 * day, featured: false,
    },
    {
      name: 'Tribal Bass Loops',
      description: 'Tribal-influenced bass loops fusing organic percussion with synthetic bass — 70 loops.',
      category: 'bass', tags: ['tribal', 'bass', 'organic', 'fusion', 'loop'],
      creatorId: 'cr-005', creatorName: 'TribeWarrior',
      price: 899, currency: 'USD', fileSize: 28_000_000,
      fileUrl: '/uploads/tribal-bass-loops.zip',
      previewUrl: '/previews/tribal-bass-loops.mp3',
      coverUrl: '/covers/tribal-bass-loops.jpg',
      bpm: 140, sampleCount: 70,
      status: 'approved', downloads: 1456, likes: 356, commentCount: 67,
      createdAt: now - 27 * day, updatedAt: now - 3 * day, featured: false,
    },
    {
      name: 'Chiptune & 8-bit Soundbank',
      description: 'Nostalgic video-game soundbank — NES, Game Boy, and SID chip sounds, 250 samples.',
      category: 'soundbank', tags: ['chiptune', '8bit', 'nes', 'gameboy', 'sid'],
      creatorId: 'cr-004', creatorName: 'RetroFuture',
      price: 1299, currency: 'USD', fileSize: 22_000_000,
      fileUrl: '/uploads/chiptune-8bit-soundbank.zip',
      previewUrl: '/previews/chiptune-8bit-soundbank.mp3',
      coverUrl: '/covers/chiptune-8bit-soundbank.jpg',
      sampleCount: 250,
      status: 'approved', downloads: 3456, likes: 876, commentCount: 145,
      createdAt: now - 78 * day, updatedAt: now - 7 * day, featured: false,
    },
    {
      name: 'Snare Rolls & Fills Kit',
      description: 'Live-feel snare rolls and drum fills — from subtle ghost rolls to devastating 32nd-note bursts.',
      category: 'snare', tags: ['rolls', 'fills', 'ghost', 'live-feel', 'drum'],
      creatorId: 'cr-007', creatorName: 'LiveMaster',
      price: 0, currency: 'USD', fileSize: 14_000_000,
      fileUrl: '/uploads/snare-rolls-fills-kit.zip',
      previewUrl: '/previews/snare-rolls-fills-kit.mp3',
      coverUrl: '/covers/snare-rolls-fills-kit.jpg',
      sampleCount: 100,
      status: 'approved', downloads: 5890, likes: 1234, commentCount: 198,
      createdAt: now - 95 * day, updatedAt: now - 9 * day, featured: false,
    },
    {
      name: 'World Perc & Ethnic Hits',
      description: 'Global percussion hits: tabla, taiko, conga, bongo, djembe, surdo and more — 200 samples.',
      category: 'perc', tags: ['world', 'tabla', 'taiko', 'conga', 'ethnic'],
      creatorId: 'cr-005', creatorName: 'TribeWarrior',
      price: 2999, currency: 'USD', fileSize: 87_000_000,
      fileUrl: '/uploads/world-perc-ethnic-hits.zip',
      previewUrl: '/previews/world-perc-ethnic-hits.mp3',
      coverUrl: '/covers/world-perc-ethnic-hits.jpg',
      sampleCount: 200,
      status: 'approved', downloads: 1234, likes: 312, commentCount: 56,
      createdAt: now - 43 * day, updatedAt: now - 4 * day, featured: false,
    },
  ]

  for (const data of seed) {
    const id = makeId()
    const slug = makeSlug(data.name)
    products.set(id, { ...data, id, slug, likedBy: new Set(), trendingScore: 0 })
    comments.set(id, [])
  }

  updateTrendingScores()
}

// ── Filters & pagination ─────────────────────────────────────
interface GetProductsOpts {
  category?: ProductCategory
  tags?: string
  search?: string
  sort?: 'trending' | 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'free'
  page?: number
  limit?: number
}

export function getProducts(filters: GetProductsOpts = {}): {
  products: MarketProduct[]
  total: number
  page: number
  pages: number
} {
  const { category, tags, search, sort = 'trending', page = 1, limit = 20 } = filters

  let result = Array.from(products.values()).filter((p) => p.status === 'approved')

  if (category) result = result.filter((p) => p.category === category)
  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    result = result.filter((p) => tagList.some((t) => p.tags.includes(t)))
  }
  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.creatorName.toLowerCase().includes(q)
    )
  }
  if (sort === 'free') result = result.filter((p) => p.price === 0)

  switch (sort) {
    case 'newest': result.sort((a, b) => b.createdAt - a.createdAt); break
    case 'popular': result.sort((a, b) => b.downloads - a.downloads); break
    case 'price-asc': result.sort((a, b) => a.price - b.price); break
    case 'price-desc': result.sort((a, b) => b.price - a.price); break
    case 'free': result.sort((a, b) => b.downloads - a.downloads); break
    default: result.sort((a, b) => b.trendingScore - a.trendingScore)
  }

  const total = result.length
  const pages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  return { products: result.slice(start, start + limit), total, page, pages }
}

export function getProduct(id: string): MarketProduct | null {
  return products.get(id) ?? null
}

export function getFeatured(): MarketProduct[] {
  return Array.from(products.values())
    .filter((p) => p.featured && p.status === 'approved')
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 6)
}

export function getTrending(limit = 10): MarketProduct[] {
  return Array.from(products.values())
    .filter((p) => p.status === 'approved')
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit)
}

export function getByCreator(creatorId: string): MarketProduct[] {
  return Array.from(products.values()).filter((p) => p.creatorId === creatorId)
}

export function toggleLike(productId: string, userId: string): { liked: boolean; likes: number } {
  const p = products.get(productId)
  if (!p) return { liked: false, likes: 0 }
  const alreadyLiked = p.likedBy.has(userId)
  if (alreadyLiked) {
    p.likedBy.delete(userId)
    p.likes = Math.max(0, p.likes - 1)
  } else {
    p.likedBy.add(userId)
    p.likes += 1
  }
  p.updatedAt = Date.now()
  return { liked: !alreadyLiked, likes: p.likes }
}

export function recordDownload(productId: string, _userId: string): void {
  const p = products.get(productId)
  if (p) {
    p.downloads += 1
    p.updatedAt = Date.now()
  }
}

export function addComment(
  productId: string,
  userId: string,
  userName: string,
  text: string,
  rating: number
): ProductComment {
  const comment: ProductComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId,
    userId,
    userName,
    text,
    rating: Math.min(5, Math.max(1, rating)),
    createdAt: Date.now(),
  }
  const list = comments.get(productId) ?? []
  list.push(comment)
  comments.set(productId, list)
  const p = products.get(productId)
  if (p) p.commentCount = list.length
  return comment
}

export function getComments(productId: string): ProductComment[] {
  return comments.get(productId) ?? []
}

export function createProduct(
  data: Omit<MarketProduct, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes' | 'likedBy' | 'commentCount' | 'trendingScore'>
): MarketProduct {
  const id = makeId()
  const slug = makeSlug(data.name)
  const now = Date.now()
  const product: MarketProduct = {
    ...data,
    id,
    slug,
    downloads: 0,
    likes: 0,
    likedBy: new Set(),
    commentCount: 0,
    trendingScore: 0,
    createdAt: now,
    updatedAt: now,
  }
  products.set(id, product)
  comments.set(id, [])
  return product
}

export function updateTrendingScores(): void {
  const now = Date.now()
  const day = 86_400_000
  for (const p of products.values()) {
    const ageInDays = (now - p.createdAt) / day
    const recencyBonus = Math.max(0, 30 - ageInDays) * 5
    p.trendingScore = p.downloads * 2 + p.likes * 3 + recencyBonus
  }
}

export function moderateProduct(
  id: string,
  status: ProductStatus,
  _reason?: string
): MarketProduct | null {
  const p = products.get(id)
  if (!p) return null
  p.status = status
  p.updatedAt = Date.now()
  return p
}

// ── Init ─────────────────────────────────────────────────────
seedProducts()
setInterval(updateTrendingScores, 5 * 60 * 1000)

// ─── Hardware Vendor / Control types ─────────────────────────────────────────

export type HardwareVendor =
  | 'akai'
  | 'arturia'
  | 'novation'
  | 'native-instruments'
  | 'generic'

export interface ControlDef {
  cc:           number
  name:         string
  type:         'knob' | 'fader' | 'button' | 'pad' | 'encoder' | 'xy'
  min:          number   // raw MIDI value
  max:          number
  defaultValue: number
  bipolar:      boolean  // centered at 64 (pans, pitches)
}

export interface HardwareProfile {
  vendor:          HardwareVendor
  model:           string
  namePatterns:    string[]   // substrings to match in port name (case-insensitive)
  inputChannels:   number[]   // default MIDI channels (0-indexed)
  controls:        ControlDef[]
  hasPads:         boolean
  padCount:        number
  padBaseNote:     number     // MIDI note of first pad
  padChannel:      number     // MIDI channel for pads
  sysexIdRequest?: number[]   // SysEx bytes to request device identity
  color:           string     // accent colour for UI
}

// ─── Helper to build a CC ControlDef ─────────────────────────────────────────

function cc(
  num: number,
  name: string,
  type: ControlDef['type'],
  bipolar = false,
  defaultValue = 64,
): ControlDef {
  return { cc: num, name, type, min: 0, max: 127, defaultValue, bipolar }
}

// ─── Profile Definitions ──────────────────────────────────────────────────────

export const HARDWARE_PROFILES: HardwareProfile[] = [

  // ── Akai MPK Mini MkII / MkIII ─────────────────────────────────────────────
  {
    vendor:        'akai',
    model:         'Akai MPK Mini',
    namePatterns:  ['mpk mini', 'akai mpk'],
    inputChannels: [0],
    hasPads:       true,
    padCount:      8,
    padBaseNote:   36,
    padChannel:    9,
    color:         '#e74c3c',
    sysexIdRequest: [0xF0, 0x47, 0x00, 0x49, 0x60, 0x00, 0x04, 0xF7],
    controls: [
      cc(1,  'Mod Wheel', 'encoder', true),
      cc(70, 'Knob 1',   'knob'),
      cc(71, 'Knob 2',   'knob'),
      cc(72, 'Knob 3',   'knob'),
      cc(73, 'Knob 4',   'knob'),
      cc(74, 'Knob 5',   'knob'),
      cc(75, 'Knob 6',   'knob'),
      cc(76, 'Knob 7',   'knob'),
      cc(77, 'Knob 8',   'knob'),
    ],
  },

  // ── Akai APC Mini / APC40 ───────────────────────────────────────────────────
  {
    vendor:        'akai',
    model:         'Akai APC',
    namePatterns:  ['apc mini', 'apc40', 'akai apc'],
    inputChannels: [0],
    hasPads:       true,
    padCount:      64,
    padBaseNote:   0,
    padChannel:    0,
    color:         '#e74c3c',
    controls: [
      cc(48, 'Fader 1',  'fader', false, 127),
      cc(49, 'Fader 2',  'fader', false, 127),
      cc(50, 'Fader 3',  'fader', false, 127),
      cc(51, 'Fader 4',  'fader', false, 127),
      cc(52, 'Fader 5',  'fader', false, 127),
      cc(53, 'Fader 6',  'fader', false, 127),
      cc(54, 'Fader 7',  'fader', false, 127),
      cc(55, 'Fader 8',  'fader', false, 127),
      cc(56, 'Master',   'fader', false, 127),
      cc(91, 'Play',     'button', false, 0),
      cc(92, 'Stop',     'button', false, 0),
      cc(93, 'Record',   'button', false, 0),
    ],
  },

  // ── Arturia KeyLab Essential / MkII ────────────────────────────────────────
  {
    vendor:        'arturia',
    model:         'Arturia KeyLab',
    namePatterns:  ['keylab', 'arturia keylab'],
    inputChannels: [0, 9],
    hasPads:       true,
    padCount:      16,
    padBaseNote:   36,
    padChannel:    9,
    color:         '#3498db',
    sysexIdRequest: [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7],
    controls: [
      // 9 faders (CC 73-80 + master 81)
      cc(73, 'Fader 1',      'fader', false, 64),
      cc(74, 'Fader 2',      'fader', false, 64),
      cc(75, 'Fader 3',      'fader', false, 64),
      cc(76, 'Fader 4',      'fader', false, 64),
      cc(77, 'Fader 5',      'fader', false, 64),
      cc(78, 'Fader 6',      'fader', false, 64),
      cc(79, 'Fader 7',      'fader', false, 64),
      cc(80, 'Fader 8',      'fader', false, 64),
      cc(81, 'Master Fader', 'fader', false, 64),
      // 9 knobs (CC 74-80 + 82-83)
      cc(82, 'Knob 1',       'knob'),
      cc(83, 'Knob 2',       'knob'),
      // Transport (CC 91-96)
      cc(91, 'Rewind',       'button', false, 0),
      cc(92, 'Fast Fwd',     'button', false, 0),
      cc(93, 'Stop',         'button', false, 0),
      cc(94, 'Play',         'button', false, 0),
      cc(95, 'Loop',         'button', false, 0),
      cc(96, 'Record',       'button', false, 0),
    ],
  },

  // ── Arturia MiniLab ─────────────────────────────────────────────────────────
  {
    vendor:        'arturia',
    model:         'Arturia MiniLab',
    namePatterns:  ['minilab', 'arturia mini'],
    inputChannels: [0],
    hasPads:       true,
    padCount:      8,
    padBaseNote:   36,
    padChannel:    9,
    color:         '#3498db',
    controls: [
      // 16 knobs (CC 74-89)
      cc(74, 'Knob 1',  'knob'),
      cc(75, 'Knob 2',  'knob'),
      cc(76, 'Knob 3',  'knob'),
      cc(77, 'Knob 4',  'knob'),
      cc(78, 'Knob 5',  'knob'),
      cc(79, 'Knob 6',  'knob'),
      cc(80, 'Knob 7',  'knob'),
      cc(81, 'Knob 8',  'knob'),
      cc(82, 'Knob 9',  'knob'),
      cc(83, 'Knob 10', 'knob'),
      cc(84, 'Knob 11', 'knob'),
      cc(85, 'Knob 12', 'knob'),
      cc(86, 'Knob 13', 'knob'),
      cc(87, 'Knob 14', 'knob'),
      cc(88, 'Knob 15', 'knob'),
      cc(89, 'Knob 16', 'knob'),
    ],
  },

  // ── Novation Launchpad (X, Mini, Pro) ───────────────────────────────────────
  {
    vendor:        'novation',
    model:         'Novation Launchpad',
    namePatterns:  ['launchpad', 'novation launchpad'],
    inputChannels: [0],
    hasPads:       true,
    padCount:      64,
    padBaseNote:   36,
    padChannel:    0,
    color:         '#2ecc71',
    sysexIdRequest: [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x60, 0xF7],
    controls: [
      // Scene launch buttons
      cc(89, 'Scene 1', 'button', false, 0),
      cc(79, 'Scene 2', 'button', false, 0),
      cc(69, 'Scene 3', 'button', false, 0),
      cc(59, 'Scene 4', 'button', false, 0),
      cc(49, 'Scene 5', 'button', false, 0),
      cc(39, 'Scene 6', 'button', false, 0),
      cc(29, 'Scene 7', 'button', false, 0),
      cc(19, 'Scene 8', 'button', false, 0),
    ],
  },

  // ── Novation Launch Control XL ──────────────────────────────────────────────
  {
    vendor:        'novation',
    model:         'Novation Launch Control XL',
    namePatterns:  ['launch control', 'novation launch'],
    inputChannels: [0],
    hasPads:       false,
    padCount:      0,
    padBaseNote:   0,
    padChannel:    0,
    color:         '#2ecc71',
    controls: [
      // 8 knobs top row (CC 21-28)
      cc(21, 'Send A 1', 'knob'),
      cc(22, 'Send A 2', 'knob'),
      cc(23, 'Send A 3', 'knob'),
      cc(24, 'Send A 4', 'knob'),
      cc(25, 'Send A 5', 'knob'),
      cc(26, 'Send A 6', 'knob'),
      cc(27, 'Send A 7', 'knob'),
      cc(28, 'Send A 8', 'knob'),
      // 8 knobs middle row (CC 41-48)
      cc(41, 'Send B 1', 'knob'),
      cc(42, 'Send B 2', 'knob'),
      cc(43, 'Send B 3', 'knob'),
      cc(44, 'Send B 4', 'knob'),
      cc(45, 'Send B 5', 'knob'),
      cc(46, 'Send B 6', 'knob'),
      cc(47, 'Send B 7', 'knob'),
      cc(48, 'Send B 8', 'knob'),
      // 8 faders (CC 77-84)
      cc(77, 'Fader 1', 'fader', false, 127),
      cc(78, 'Fader 2', 'fader', false, 127),
      cc(79, 'Fader 3', 'fader', false, 127),
      cc(80, 'Fader 4', 'fader', false, 127),
      cc(81, 'Fader 5', 'fader', false, 127),
      cc(82, 'Fader 6', 'fader', false, 127),
      cc(83, 'Fader 7', 'fader', false, 127),
      cc(84, 'Fader 8', 'fader', false, 127),
    ],
  },

  // ── Native Instruments Komplete Kontrol ────────────────────────────────────
  {
    vendor:        'native-instruments',
    model:         'Komplete Kontrol',
    namePatterns:  ['komplete kontrol', 'ni komplete'],
    inputChannels: [0],
    hasPads:       false,
    padCount:      0,
    padBaseNote:   0,
    padChannel:    0,
    color:         '#9b59b6',
    sysexIdRequest: [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7],
    controls: [
      // 8 knobs (CC 50-57)
      cc(50, 'Knob 1',   'knob'),
      cc(51, 'Knob 2',   'knob'),
      cc(52, 'Knob 3',   'knob'),
      cc(53, 'Knob 4',   'knob'),
      cc(54, 'Knob 5',   'knob'),
      cc(55, 'Knob 6',   'knob'),
      cc(56, 'Knob 7',   'knob'),
      cc(57, 'Knob 8',   'knob'),
      // Smart strips (touch strips)
      cc(58, 'Strip 1',  'xy', false, 0),
      cc(59, 'Strip 2',  'xy', false, 0),
      cc(60, 'Strip 3',  'xy', false, 0),
      cc(61, 'Strip 4',  'xy', false, 0),
      cc(62, 'Strip 5',  'xy', false, 0),
      cc(63, 'Strip 6',  'xy', false, 0),
      cc(64, 'Strip 7',  'xy', false, 0),
      cc(65, 'Strip 8',  'xy', false, 0),
      // Transport
      cc(116, 'Play',    'button', false, 0),
      cc(117, 'Restart', 'button', false, 0),
      cc(118, 'Record',  'button', false, 0),
      cc(119, 'Loop',    'button', false, 0),
    ],
  },

  // ── Native Instruments Maschine ─────────────────────────────────────────────
  {
    vendor:        'native-instruments',
    model:         'Maschine',
    namePatterns:  ['maschine', 'ni maschine'],
    inputChannels: [9],
    hasPads:       true,
    padCount:      16,
    padBaseNote:   36,
    padChannel:    9,
    color:         '#9b59b6',
    controls: [
      // 8 knobs
      cc(14, 'Knob 1',  'knob'),
      cc(15, 'Knob 2',  'knob'),
      cc(16, 'Knob 3',  'knob'),
      cc(17, 'Knob 4',  'knob'),
      cc(18, 'Knob 5',  'knob'),
      cc(19, 'Knob 6',  'knob'),
      cc(20, 'Knob 7',  'knob'),
      cc(21, 'Knob 8',  'knob'),
      // Transport
      cc(116, 'Play',   'button', false, 0),
      cc(117, 'Stop',   'button', false, 0),
      cc(118, 'Record', 'button', false, 0),
    ],
  },
]

// ─── Generic fallback profile ─────────────────────────────────────────────────

const GENERIC_PROFILE: HardwareProfile = {
  vendor:        'generic',
  model:         'Generic MIDI Device',
  namePatterns:  [],
  inputChannels: [0],
  hasPads:       false,
  padCount:      0,
  padBaseNote:   0,
  padChannel:    0,
  color:         '#64748b',
  controls:      [],
}

// ─── Exported helpers ─────────────────────────────────────────────────────────

/**
 * Returns the first matching HardwareProfile for a given MIDI port name,
 * or the generic fallback profile if no match is found.
 */
export function detectProfile(portName: string): HardwareProfile {
  const lower = portName.toLowerCase()
  const match = HARDWARE_PROFILES.find(profile =>
    profile.namePatterns.some(pattern => lower.includes(pattern)),
  )
  return match ?? { ...GENERIC_PROFILE, model: portName || GENERIC_PROFILE.model }
}

/**
 * Returns the accent colour associated with a hardware vendor.
 */
export function getVendorColor(vendor: HardwareVendor): string {
  switch (vendor) {
    case 'akai':               return '#e74c3c'
    case 'arturia':            return '#3498db'
    case 'novation':           return '#2ecc71'
    case 'native-instruments': return '#9b59b6'
    case 'generic':            return '#64748b'
  }
}

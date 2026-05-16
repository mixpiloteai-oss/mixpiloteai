// ============================================================
// NEUROTEK AI — DAW Compatibility Data
// ============================================================

export interface DawInfo {
  id: string;
  name: string;
  color: string;
  accentColor?: string;
  versions: string[];
  exportFormat: string;
  templateCount: number;
  features: string[];
  midiControllers: string[];
  setupSteps: string[];
  tips: string[];
  logo: string;
}

export const DAWS: DawInfo[] = [
  {
    id: 'ableton', name: 'Ableton Live', color: '#f59e0b', accentColor: '#d97706',
    versions: ['11', '12'], exportFormat: '.als', templateCount: 12,
    features: ['MIDI', 'Push 2', 'Max for Live', 'Live Set', 'Rack System', 'Audio Effects'],
    midiControllers: ['Ableton Push 2', 'Ableton Push 3', 'Launchpad Pro', 'Launchpad X'],
    setupSteps: [
      'Open Ableton Live and go to File > Open Live Set',
      'Import the exported .als template file',
      'Set the MIDI input to your controller',
      'Map NEUROTEK AI parameters using MIDI Map mode (Cmd+M)',
      'Save your customized Live Set',
    ],
    tips: [
      'Use Max for Live devices to create custom NEUROTEK AI automation',
      'Push 2 pads correspond 1:1 to NEUROTEK AI pad layout',
      'Use Session View for live performance with AI-generated clips',
    ],
    logo: '🎩',
  },
  {
    id: 'flstudio', name: 'FL Studio', color: '#06b6d4', accentColor: '#0891b2',
    versions: ['21'], exportFormat: '.flp', templateCount: 8,
    features: ['Piano Roll', 'Step Sequencer', 'Mixer', 'Automation', 'Fruity Wrapper'],
    midiControllers: ['AKAI MPD218', 'Novation Launchpad', 'Native Instruments Maschine'],
    setupSteps: [
      'Open FL Studio and select File > Open',
      'Navigate to the exported .flp template',
      'Configure MIDI settings in Options > MIDI Settings',
      'Assign NEUROTEK AI channels to FL Mixer tracks',
    ],
    tips: [
      'Use the Piano Roll note colors to match NEUROTEK AI track colors',
      'Patcher plugin enables complex NEUROTEK AI routing chains',
    ],
    logo: '🎛',
  },
  {
    id: 'reaper', name: 'Reaper', color: '#10b981', accentColor: '#059669',
    versions: ['6', '7'], exportFormat: '.rpp', templateCount: 6,
    features: ['MIDI', 'ReaScript', 'JSFX', 'Flexible Routing', 'Project Templates'],
    midiControllers: ['Generic MIDI', 'Behringer X-Touch', 'Faderport'],
    setupSteps: [
      'Open Reaper and select File > Open Project',
      'Load the exported .rpp template',
      'Go to Options > Preferences > MIDI Devices',
      'Use ReaScript to automate NEUROTEK AI parameters',
    ],
    tips: [
      "Reaper's flexible routing makes it ideal for complex signal chains",
      'Use project templates to save your NEUROTEK AI setup',
    ],
    logo: '🔊',
  },
  {
    id: 'bitwig', name: 'Bitwig Studio', color: '#7c3aed', accentColor: '#6d28d9',
    versions: ['5'], exportFormat: '.bwpreset', templateCount: 5,
    features: ['The Grid', 'Modulators', 'Hardware Integration', 'Clip Launcher', 'Polysynth'],
    midiControllers: ['Bitwig-ready Controllers', 'Ableton Push', 'Launchpad'],
    setupSteps: [
      'Open Bitwig Studio',
      'Import the .bwpreset file via the Browser panel',
      'Configure your controller in Preferences > Controllers',
      'Map NEUROTEK AI parameters using Learn MIDI',
    ],
    tips: [
      'The Grid enables visual patch building that mirrors NEUROTEK AI routing',
      'Clip launcher setup is 1:1 compatible with NEUROTEK AI Live Mode',
    ],
    logo: '⚡',
  },
  {
    id: 'logic', name: 'Logic Pro', color: '#06b6d4', accentColor: '#0284c7',
    versions: ['10.7', '10.8'], exportFormat: '.logicx', templateCount: 4,
    features: ['Drummer', 'Alchemy', 'Smart Tempo', 'Step Sequencer', 'Spatial Audio'],
    midiControllers: ['Logic Remote (iPad)', 'Arturia KeyLab', 'Native Instruments'],
    setupSteps: [
      'Open Logic Pro and select File > Open',
      'Load the exported .logicx project',
      'Go to Logic Pro > Preferences > MIDI',
      'Use Smart Controls to map NEUROTEK AI parameters',
    ],
    tips: [
      'Use Logic Remote on iPad to control NEUROTEK AI parameters wirelessly',
      'Smart Tempo detection aligns Logic projects with NEUROTEK AI BPM',
    ],
    logo: '🎵',
  },
  {
    id: 'cubase', name: 'Cubase', color: '#ec4899', accentColor: '#db2777',
    versions: ['13'], exportFormat: '.cpr', templateCount: 4,
    features: ['VariAudio', 'Chord Track', 'MIDI Remote', 'HALion', 'Groove Agent'],
    midiControllers: ['Steinberg CC121', 'Yamaha Nuage', 'Arturia Controllers'],
    setupSteps: [
      'Open Cubase and select File > Open',
      'Load the exported .cpr project template',
      'Go to Studio > MIDI Remote Manager',
      'Assign parameters using MIDI Learn mode',
    ],
    tips: [
      'MIDI Remote API allows custom NEUROTEK AI controller scripts',
      'Use Project Templates to persist your NEUROTEK AI setup',
    ],
    logo: '🎼',
  },
];

export const MIDI_CONTROLLERS = [
  { id: 'push2', name: 'Ableton Push 2', compatible: ['ableton'], notes: 64, pads: true },
  { id: 'push3', name: 'Ableton Push 3', compatible: ['ableton'], notes: 64, pads: true },
  { id: 'launchpad-pro', name: 'Launchpad Pro', compatible: ['ableton', 'bitwig', 'logic'], notes: 64, pads: true },
  { id: 'launchpad-x', name: 'Launchpad X', compatible: ['ableton', 'bitwig'], notes: 64, pads: true },
  { id: 'maschine', name: 'NI Maschine MK3', compatible: ['all'], notes: 16, pads: true },
  { id: 'keylab', name: 'Arturia KeyLab 49', compatible: ['all'], notes: 49, pads: false },
  { id: 'akai-mpd', name: 'AKAI MPD226', compatible: ['all'], notes: 0, pads: true },
];

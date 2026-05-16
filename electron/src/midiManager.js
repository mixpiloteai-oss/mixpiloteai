// ============================================================
// MIDI Manager — CommonJS module
// Lists connected MIDI input/output devices via @julusian/midi
// Falls back gracefully if native module is unavailable.
// ============================================================

const KNOWN_BRANDS = [
  { keywords: ['APC'],        label: 'Akai APC' },
  { keywords: ['MPC'],        label: 'Akai MPC' },
  { keywords: ['MPK'],        label: 'Akai MPK' },
  { keywords: ['Launchpad'],  label: 'Novation Launchpad' },
  { keywords: ['Maschine'],   label: 'NI Maschine' },
  { keywords: ['Komplete'],   label: 'NI Komplete' },
  { keywords: ['Arturia'],    label: 'Arturia' },
];

function enrichDeviceName(name) {
  for (const brand of KNOWN_BRANDS) {
    for (const kw of brand.keywords) {
      if (name.includes(kw)) return `${name} (${brand.label})`;
    }
  }
  return name;
}

function getMidiDevices() {
  let midi;
  try {
    midi = require('@julusian/midi');
  } catch (_) {
    console.warn('[MidiManager] @julusian/midi not available — returning empty device list');
    return { inputs: [], outputs: [], total: 0 };
  }

  const inputs = [];
  const outputs = [];

  try {
    const inputPort = new midi.Input();
    const inputCount = inputPort.getPortCount();
    for (let i = 0; i < inputCount; i++) {
      const raw = inputPort.getPortName(i);
      inputs.push({ id: i, name: enrichDeviceName(raw) });
    }
    inputPort.closePort();
  } catch (err) {
    console.error('[MidiManager] Error listing MIDI inputs:', err.message);
  }

  try {
    const outputPort = new midi.Output();
    const outputCount = outputPort.getPortCount();
    for (let i = 0; i < outputCount; i++) {
      const raw = outputPort.getPortName(i);
      outputs.push({ id: i, name: enrichDeviceName(raw) });
    }
    outputPort.closePort();
  } catch (err) {
    console.error('[MidiManager] Error listing MIDI outputs:', err.message);
  }

  return { inputs, outputs, total: inputs.length + outputs.length };
}

module.exports = { getMidiDevices };

// ============================================================
// NEUROTEK AI — Audio Device Manager
// Enumerate system audio I/O devices via platform-specific methods
// ============================================================
'use strict';

const { execSync } = require('child_process');
const os = require('os');

/**
 * Returns { inputs: AudioDevice[], outputs: AudioDevice[], defaultInput, defaultOutput }
 * AudioDevice: { id: string, name: string, channels: number, sampleRates: number[], isDefault: boolean }
 */
function getAudioDevices() {
  const platform = process.platform;
  try {
    if (platform === 'darwin') return getMacDevices();
    if (platform === 'win32') return getWindowsDevices();
    return getLinuxDevices();
  } catch (err) {
    console.error('[AudioDeviceManager]', err.message);
    return { inputs: [], outputs: [], defaultInput: null, defaultOutput: null };
  }
}

// ── macOS: system_profiler ───────────────────────────────────
function getMacDevices() {
  let raw = '';
  try {
    raw = execSync('system_profiler SPAudioDataType -json 2>/dev/null', { timeout: 5000 }).toString();
  } catch (_) {
    return getFallbackDevices();
  }

  const inputs = [];
  const outputs = [];

  try {
    const parsed = JSON.parse(raw);
    const audioData = parsed?.SPAudioDataType ?? [];
    for (const section of audioData) {
      const items = section['_items'] ?? [];
      for (const item of items) {
        const name = item['_name'] ?? 'Unknown';
        const hasInput = item['coreaudio_input_source'] != null || name.toLowerCase().includes('input') || name.toLowerCase().includes('mic');
        const hasOutput = item['coreaudio_output_source'] != null || !hasInput;

        const device = {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          channels: 2,
          sampleRates: [44100, 48000, 96000],
          isDefault: false,
        };

        if (hasInput) inputs.push({ ...device, id: `input-${device.id}` });
        if (hasOutput) outputs.push({ ...device, id: `output-${device.id}` });
      }
    }
  } catch (_) {
    return getFallbackDevices();
  }

  return {
    inputs,
    outputs,
    defaultInput: inputs[0]?.id ?? null,
    defaultOutput: outputs[0]?.id ?? null,
  };
}

// ── Windows: PowerShell ──────────────────────────────────────
function getWindowsDevices() {
  let raw = '';
  try {
    raw = execSync(
      'powershell -Command "Get-WmiObject Win32_SoundDevice | Select-Object Name,Status | ConvertTo-Json"',
      { timeout: 6000, shell: true }
    ).toString();
  } catch (_) {
    return getFallbackDevices();
  }

  const devices = [];
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const d of list) {
      if (!d?.Name) continue;
      devices.push({
        id: d.Name.toLowerCase().replace(/\s+/g, '-'),
        name: d.Name,
        channels: 2,
        sampleRates: [44100, 48000],
        isDefault: false,
      });
    }
  } catch (_) {
    return getFallbackDevices();
  }

  return {
    inputs: devices.map((d) => ({ ...d, id: `input-${d.id}` })),
    outputs: devices,
    defaultInput: devices[0] ? `input-${devices[0].id}` : null,
    defaultOutput: devices[0]?.id ?? null,
  };
}

// ── Linux: aplay/arecord ─────────────────────────────────────
function getLinuxDevices() {
  const outputs = [];
  const inputs = [];

  try {
    const aplay = execSync('aplay -l 2>/dev/null', { timeout: 3000 }).toString();
    for (const line of aplay.split('\n')) {
      const m = line.match(/card (\d+): (\w+) \[([^\]]+)\]/);
      if (m) {
        outputs.push({
          id: `output-card${m[1]}`,
          name: m[3],
          channels: 2,
          sampleRates: [44100, 48000],
          isDefault: outputs.length === 0,
        });
      }
    }
  } catch (_) {}

  try {
    const arecord = execSync('arecord -l 2>/dev/null', { timeout: 3000 }).toString();
    for (const line of arecord.split('\n')) {
      const m = line.match(/card (\d+): (\w+) \[([^\]]+)\]/);
      if (m) {
        inputs.push({
          id: `input-card${m[1]}`,
          name: m[3],
          channels: 2,
          sampleRates: [44100, 48000],
          isDefault: inputs.length === 0,
        });
      }
    }
  } catch (_) {}

  if (!outputs.length && !inputs.length) return getFallbackDevices();

  return {
    inputs,
    outputs,
    defaultInput: inputs[0]?.id ?? null,
    defaultOutput: outputs[0]?.id ?? null,
  };
}

// ── Fallback (minimal safe response) ────────────────────────
function getFallbackDevices() {
  const builtIn = {
    id: 'builtin',
    name: 'Built-in Audio',
    channels: 2,
    sampleRates: [44100, 48000],
    isDefault: true,
  };
  return {
    inputs: [{ ...builtIn, id: 'input-builtin', name: 'Built-in Microphone' }],
    outputs: [builtIn],
    defaultInput: 'input-builtin',
    defaultOutput: 'builtin',
  };
}

function getLatencyProfiles() {
  return [
    { id: 'ultra', label: 'Ultra Low (1–4 ms)', bufferSize: 64,  sampleRate: 48000 },
    { id: 'low',   label: 'Low (4–8 ms)',        bufferSize: 128, sampleRate: 48000 },
    { id: 'med',   label: 'Balanced (8–16 ms)',  bufferSize: 256, sampleRate: 44100 },
    { id: 'safe',  label: 'Safe (16–32 ms)',      bufferSize: 512, sampleRate: 44100 },
  ];
}

module.exports = { getAudioDevices, getLatencyProfiles };

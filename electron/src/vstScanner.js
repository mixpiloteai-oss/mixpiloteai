// ============================================================
// VST Plugin Scanner — CommonJS module
// Scans standard VST2/VST3 paths per platform
// ============================================================
const fs = require('fs');
const path = require('path');
const os = require('os');

const VST2_PATHS = {
  win32: [
    'C:/Program Files/VSTPlugins',
    'C:/Program Files/Common Files/VST2',
    'C:/Program Files (x86)/VSTPlugins',
  ],
  darwin: [
    '/Library/Audio/Plug-Ins/VST',
    path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST'),
  ],
  linux: [
    path.join(os.homedir(), '.vst'),
    '/usr/lib/vst',
    '/usr/local/lib/vst',
  ],
};

const VST3_PATHS = {
  win32: ['C:/Program Files/Common Files/VST3'],
  darwin: [
    '/Library/Audio/Plug-Ins/VST3',
    path.join(os.homedir(), 'Library/Audio/Plug-Ins/VST3'),
  ],
  linux: [
    path.join(os.homedir(), '.vst3'),
    '/usr/lib/vst3',
  ],
};

function scanDir(dir, type, extensions, results) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      try { scanDir(fullPath, type, extensions, results); } catch (_) {}
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        let size = 0;
        try { size = fs.statSync(fullPath).size; } catch (_) {}
        results.push({ name: path.basename(entry.name, ext), path: fullPath, type, size });
      }
    }
  }
}

function scanVSTPlugins() {
  const platform = process.platform;
  const results = [];

  const vst2Paths = VST2_PATHS[platform] || [];
  const vst2Extensions = platform === 'win32' ? ['.dll'] : ['.vst'];
  for (const dir of vst2Paths) scanDir(dir, 'VST2', vst2Extensions, results);

  const vst3Paths = VST3_PATHS[platform] || [];
  for (const dir of vst3Paths) scanDir(dir, 'VST3', ['.vst3'], results);

  const seen = new Set();
  return results.filter((p) => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}

module.exports = { scanVSTPlugins };

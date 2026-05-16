// ============================================================
// NEUROTEK AI — Project Manager
// Persistence: localStorage + file export/import
// ============================================================

// ─── Local type definitions ──────────────────────────────────

interface EQBand {
  freq: number;
  gain: number;
  q: number;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  enabled: boolean;
}

interface CompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  enabled: boolean;
}

interface MixChannel {
  id: string;
  name: string;
  type: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  eq: [EQBand, EQBand, EQBand];
  compressor: CompressorSettings;
  reverbSend: number;
  delaySend: number;
}

interface Note {
  id: string;
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
  channel: string;
}

interface Pattern {
  id: string;
  name: string;
  channelId: string;
  notes: Note[];
  lengthBars: number;
  color: string;
}

interface ArrClip {
  id: string;
  patternId: string;
  trackId: string;
  startBar: number;
  durationBars: number;
  color: string;
}

export interface ProjectSave {
  version: string;
  id: string;
  name: string;
  bpm: number;
  masterVolume: number;
  timeSignature: [number, number];
  patterns: Pattern[];
  arrangement: ArrClip[];
  mixerChannels: MixChannel[];
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────

const LS_PROJECTS = 'nt_projects';
const LS_AUTOSAVE = 'nt_autosave';
const PROJECT_VERSION = '1.0.0';

// ─── Private helpers ─────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultEQ(): [EQBand, EQBand, EQBand] {
  return [
    { freq: 100,  gain: 0, q: 0.707, type: 'lowshelf',  enabled: true },
    { freq: 1000, gain: 0, q: 0.707, type: 'peaking',   enabled: true },
    { freq: 8000, gain: 0, q: 0.707, type: 'highshelf', enabled: true },
  ];
}

function defaultCompressor(): CompressorSettings {
  return {
    threshold: -24,
    ratio: 4,
    attack: 10,
    release: 200,
    makeupGain: 0,
    enabled: false,
  };
}

function makeChannel(
  id: string,
  name: string,
  type: string,
  color: string,
): MixChannel {
  return {
    id,
    name,
    type,
    color,
    volume: 0.75,
    pan: 0,
    muted: false,
    soloed: false,
    eq: defaultEQ(),
    compressor: defaultCompressor(),
    reverbSend: 0.1,
    delaySend: 0,
  };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Create a fresh project with default mixer channels.
 */
export function createProject(name: string): ProjectSave {
  const now = new Date().toISOString();
  const id = uid();

  const mixerChannels: MixChannel[] = [
    makeChannel(uid(), 'Kick',   'kick',      '#ef4444'),
    makeChannel(uid(), 'Bass',   'bass',      '#f59e0b'),
    makeChannel(uid(), 'Melody', 'melody',    '#10b981'),
    makeChannel(uid(), 'Perc',   'percussion','#06b6d4'),
    makeChannel(uid(), 'FX',     'fx',        '#8b5cf6'),
    makeChannel(uid(), 'Acid',   'acid',      '#ec4899'),
  ];

  return {
    version: PROJECT_VERSION,
    id,
    name,
    bpm: 140,
    masterVolume: 0.85,
    timeSignature: [4, 4],
    patterns: [],
    arrangement: [],
    mixerChannels,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Upsert a project into the localStorage project list.
 */
export function saveProject(project: ProjectSave): void {
  const all = loadAllProjects();
  project.updatedAt = new Date().toISOString();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    all[idx] = project;
  } else {
    all.push(project);
  }
  localStorage.setItem(LS_PROJECTS, JSON.stringify(all));
}

/**
 * Load all saved projects from localStorage.
 */
export function loadAllProjects(): ProjectSave[] {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectSave[];
  } catch {
    return [];
  }
}

/**
 * Load a single project by id.
 */
export function loadProject(id: string): ProjectSave | null {
  return loadAllProjects().find((p) => p.id === id) ?? null;
}

/**
 * Permanently delete a project by id.
 */
export function deleteProject(id: string): void {
  const filtered = loadAllProjects().filter((p) => p.id !== id);
  localStorage.setItem(LS_PROJECTS, JSON.stringify(filtered));
}

/**
 * Write the project to the autosave slot (does not touch the main list).
 */
export function autoSave(project: ProjectSave): void {
  const snapshot: ProjectSave = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_AUTOSAVE, JSON.stringify(snapshot));
}

/**
 * Retrieve the autosave snapshot, or null if none exists.
 */
export function loadAutoSave(): ProjectSave | null {
  try {
    const raw = localStorage.getItem(LS_AUTOSAVE);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectSave;
  } catch {
    return null;
  }
}

/**
 * Trigger a browser download of the project as a `.neurotek` JSON file.
 */
export function exportProjectJSON(project: ProjectSave): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}_${project.id.slice(0, 6)}.neurotek`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a `.neurotek` file, validate it, and return a ProjectSave with a
 * fresh id to avoid collisions with existing projects.
 */
export function importProjectJSON(file: File): Promise<ProjectSave> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as Partial<ProjectSave>;

        if (!parsed.id || !parsed.name) {
          reject(new Error('Invalid project file: missing id or name'));
          return;
        }

        const imported: ProjectSave = {
          ...(parsed as ProjectSave),
          id: uid(),
          updatedAt: new Date().toISOString(),
        };

        resolve(imported);
      } catch (err) {
        reject(new Error(`Failed to parse project file: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Start a recurring autosave timer.
 * @returns A cleanup function that stops the timer.
 */
export function startAutoSave(
  getProject: () => ProjectSave,
  intervalMs = 30_000,
): () => void {
  const timer = setInterval(() => {
    autoSave(getProject());
  }, intervalMs);

  return () => clearInterval(timer);
}

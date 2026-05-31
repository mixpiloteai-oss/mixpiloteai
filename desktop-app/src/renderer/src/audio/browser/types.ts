// ─── Core sample type ─────────────────────────────────────────────────────

export interface SampleEntry {
  id:           string                    // SHA-like hash of path
  name:         string                    // filename sans extension
  ext:          string                    // '.wav', '.mp3', '.flac', '.aif', '.ogg'
  path:         string                    // virtual path (folder/subfolder/name)
  size:         number                    // bytes
  duration:     number                    // seconds, 0 if not analyzed
  sampleRate:   number                    // Hz, 0 if unknown
  channels:     number                    // 1=mono 2=stereo
  bpm:          number | null             // detected BPM
  key:          string | null             // e.g. "C major", "A minor"
  style:        string[]                  // detected style tags
  userTags:     string[]                  // user-defined tags
  favorite:     boolean
  dateAdded:    number                    // timestamp ms
  analyzed:     boolean                   // true when audio analysis complete
  waveformData: number[] | null           // 200 downsampled RMS points, normalized 0-1
  // Runtime only — not persisted in IndexedDB
  fileHandle?:  FileSystemFileHandle
}

export type SampleSort = 'name' | 'date' | 'duration' | 'bpm' | 'key' | 'size'
export type SortDir    = 'asc' | 'desc'

export interface SampleFilter {
  search:        string
  extensions:    string[]     // [] = all
  bpmMin:        number | null
  bpmMax:        number | null
  keys:          string[]     // [] = all
  styles:        string[]     // [] = all
  favoritesOnly: boolean
  minDuration:   number | null  // seconds
  maxDuration:   number | null
}

export const DEFAULT_FILTER: SampleFilter = {
  search:        '',
  extensions:    [],
  bpmMin:        null,
  bpmMax:        null,
  keys:          [],
  styles:        [],
  favoritesOnly: false,
  minDuration:   null,
  maxDuration:   null,
}

export interface FolderNode {
  name:     string
  path:     string
  children: FolderNode[]
  count:    number     // total samples in subtree
}

export interface ScanProgress {
  scanned:  number
  total:    number
  current:  string    // current file being processed
  done:     boolean
}

// ─── Collections & Smart folders (renderer mirror of main-process types) ──────

export interface SampleCollection {
  id:        string
  name:      string
  sampleIds: string[]
  createdAt: number
  updatedAt: number
}

export interface SmartFolder {
  id:        string
  name:      string
  query:     string
  type:      string | null
  favorite:  boolean | null
  tags:      string[]
  createdAt: number
}

// ─── Recent history (renderer-only, not persisted to main process) ─────────────

export interface RecentEntry {
  sampleId:   string
  name:       string
  path:       string
  accessedAt: number   // ms timestamp
}

// ─── AI classifier readiness interface ───────────────────────────────────────

export interface AIClassification {
  style:      string[]     // e.g. ['kick', 'electronic', 'trap']
  mood:       string[]     // e.g. ['energetic', 'dark']
  confidence: number       // 0.0–1.0
  modelName:  string       // identifier of the model that produced this
}

export interface IAIClassifier {
  readonly name: string
  isAvailable(): boolean
  classify(buffer: Float32Array, sampleRate: number): Promise<AIClassification>
}

// Registry for future AI classifier plugins
const _aiClassifiers = new Map<string, IAIClassifier>()

export const AIClassifierRegistry = {
  register(classifier: IAIClassifier): void {
    _aiClassifiers.set(classifier.name, classifier)
  },
  unregister(name: string): void {
    _aiClassifiers.delete(name)
  },
  list(): IAIClassifier[] {
    return [..._aiClassifiers.values()]
  },
  get(name: string): IAIClassifier | undefined {
    return _aiClassifiers.get(name)
  },
}

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

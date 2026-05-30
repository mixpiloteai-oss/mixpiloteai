/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  setAlwaysOnTop: (flag: boolean) => Promise<void>
  openExternal: (url: string) => Promise<void>
  getSystemInfo: () => Promise<Record<string, unknown>>
  checkUpdate:       () => Promise<unknown>
  downloadUpdate:    () => Promise<void>
  installUpdate:     () => Promise<void>
  getVersion:        () => Promise<string>
  getMidiDevices: () => Promise<{ inputs: string[]; outputs: string[] }>
  scanVSTPlugins: () => Promise<unknown[]>
  getVSTPlugins: () => Promise<unknown[]>
  saveProject: (data: unknown) => Promise<string | null>
  loadProject: () => Promise<unknown>
  offlineSave: (id: string, data: unknown) => Promise<void>
  offlineLoad: (id: string) => Promise<unknown>
  offlineList: () => Promise<string[]>
  offlineDelete: (id: string) => Promise<void>
  saveSetting: (key: string, val: unknown) => Promise<void>
  loadSetting: (key: string) => Promise<unknown>
  settingsGet: (key: string) => Promise<unknown>
  settingsSet: (key: string, val: unknown) => Promise<void>
  settingsGetAll: () => Promise<Record<string, unknown>>
  settingsReset: (key: string) => Promise<void>
  autosaveSaveNow: (data: unknown) => Promise<{ savedAt: string }>
  autosaveLoadLatest: () => Promise<unknown>
  autosaveListVersions: () => Promise<{ filename: string; savedAt: string; sizeBytes: number }[]>
  autosaveGetVersion: (filename: string) => Promise<unknown>
  autosaveDeleteVersion: (filename: string) => Promise<void>
  crashSaveCheckpoint: (data: unknown) => Promise<void>
  getAudioDevices: () => Promise<{ inputs: unknown[]; outputs: unknown[] }>
  getAudioSettings: () => Promise<Record<string, unknown>>
  setAudioSettings: (s: unknown) => Promise<void>
  openFileDialog: (opts: unknown) => Promise<string[] | null>
  saveFileDialog: (opts: unknown) => Promise<string | null>
  readFile: (p: string) => Promise<string | null>
  writeFile: (p: string, content: string) => Promise<void>
  showNotification: (title: string, body: string) => Promise<void>
  debugGetBuildInfo: () => Promise<Record<string, unknown>>
  debugOpenDevTools: () => Promise<void>
  crashCheck: () => Promise<{ hadCrash: boolean; checkpoint: unknown }>
  crashClearCheckpoint: () => Promise<void>
  onNav: (cb: (view: string) => void) => void
  onTriggerSave: (cb: () => void) => void
  onTriggerLoad: (cb: () => void) => void
  onMenuAction: (cb: (action: string) => void) => void
  onPowerEvent: (cb: (event: string) => void) => void
  onUpdateChecking:     (cb: (info: unknown) => void) => void
  onUpdateAvailable:    (cb: (info: unknown) => void) => void
  onUpdateNotAvailable: (cb: (info: unknown) => void) => void
  onUpdateProgress:     (cb: (info: unknown) => void) => void
  onUpdateDownloaded:   (cb: (info: unknown) => void) => void
  onUpdateError:            (cb: (info: unknown) => void) => void
  onUpdateIntegrityReady:   (cb: (info: unknown) => void) => void
  onCrashRecoveryAvailable: (cb: (info: unknown) => void) => void
  versionHistory:     () => Promise<unknown>
  versionCanRollback: () => Promise<boolean>
  versionRollback:    () => Promise<{ ok: boolean; reason?: string }>
  verifyUpdateFile:   (filePath: string, sha256: string) => Promise<unknown>
  pluginScan:                () => Promise<unknown[]>
  pluginLoad:                (path: string, format: string) => Promise<{ instanceId: string; name: string; vendor: string; paramCount: number; pid: number; latencySamples?: number }>
  pluginUnload:              (instanceId: string) => Promise<{ ok: boolean }>
  pluginGetInstances:        () => Promise<unknown[]>
  pluginGetBlacklist:        () => Promise<{ path: string; name: string; crashCount: number; blacklistedAt: number | null }[]>
  pluginRemoveFromBlacklist: (path: string) => Promise<{ ok: boolean }>
  pluginListPresets:         (pluginId: string) => Promise<{ id: string; name: string; savedAt: number; isFactory: boolean }[]>
  pluginSavePreset:          (pluginId: string, name: string, data: Record<string, number>) => Promise<{ id: string; name: string }>
  pluginLoadPreset:          (pluginId: string, presetId: string) => Promise<{ data: Record<string, number> } | null>
  pluginDeletePreset:        (pluginId: string, presetId: string) => Promise<{ ok: boolean }>
  pluginRenamePreset:        (pluginId: string, presetId: string, name: string) => Promise<{ name: string } | null>
  // Parameter control
  pluginSetParameter:        (instanceId: string, paramId: number, value: number) => Promise<{ ok: boolean }>
  pluginGetParameter:        (instanceId: string, paramId: number) => Promise<{ value: number } | null>
  // Audio chain routing
  pluginAddToChain:          (instanceId: string, trackId: string) => Promise<{ ok: boolean }>
  pluginRemoveFromChain:     (instanceId: string, trackId: string) => Promise<{ ok: boolean }>
  // MIDI routing
  pluginSetMidiRoute:        (instanceId: string, fromTrackId: string, channel: number, deviceId?: string) => Promise<{ ok: boolean }>
  pluginGetAudioRoutes:      () => Promise<unknown[]>
  // Health & recovery
  pluginGetHealth:           () => Promise<unknown[]>
  pluginGetInstanceHealth:   (instanceId: string) => Promise<{ memoryMb: number; cpuPercent: number; uptimeMs: number } | null>
  pluginHotReload:           (instanceId: string) => Promise<{ ok: boolean }>
  pluginSaveState:           (instanceId: string, pluginPath: string, format: string, parameters: Record<string, number>, trackId?: string) => Promise<{ ok: boolean }>
  pluginGetRecoveredId:      (oldInstanceId: string) => Promise<{ newInstanceId: string | null }>
  pluginScanClearCache:      () => Promise<void>
  pluginScanCleanupCache:    () => Promise<{ removed: number }>
  pluginScanCacheStats:      () => Promise<unknown>
  // Events
  onPluginCrashed:           (cb: (info: { instanceId: string; pluginPath: string; pluginName: string; crashCount: number; blacklisted: boolean }) => void) => void
  onPluginRecovered:         (cb: (info: { oldInstanceId: string; newInstanceId: string; pluginPath: string }) => void) => void
  onPluginRecoveryFailed:    (cb: (info: unknown) => void) => void
  onPluginRecoveryAbandoned: (cb: (info: unknown) => void) => void
  onPluginResourceWarning:   (cb: (info: unknown) => void) => void
  removeAllListeners: (channel: string) => void
  platform: string
  isElectron: true
  // Performance / autosave / crash-recovery (perf: namespace)
  perfGetMemoryMetrics:     () => Promise<{ heapUsedMB: number; heapTotalMB: number; rssMB: number }>
  perfGetCpuMetrics:        () => Promise<{ userMs: number; systemMs: number }>
  perfAutosaveSave:         (data: unknown) => Promise<{ savedAt: string }>
  perfAutosaveLoadLatest:   () => Promise<unknown>
  perfAutosaveListVersions: () => Promise<{ filename: string; savedAt: string; sizeBytes: number }[]>
  perfAutosaveGetVersion:   (filename: string) => Promise<unknown>
  perfCrashWriteMarker:     (sessionId: string) => Promise<void>
  perfCrashHasMarker:       (sessionId: string) => Promise<boolean>
  perfCrashClearMarker:     (sessionId: string) => Promise<void>
  perfCrashListMarkers:     () => Promise<string[]>
  // Mixer detachable window
  mixerOpenWindow:  () => Promise<void>
  mixerCloseWindow: () => Promise<void>
  // Recording IPC
  recordingStart: (opts: {
    trackId:      string
    takeNumber:   number
    format:       'wav' | 'flac'
    sampleRate:   number
    channelCount: number
    bitDepth:     16 | 24 | 32
  }) => Promise<{ sessionId: string }>
  recordingChunk:    (payload: { sessionId: string; data: number[] }) => Promise<void>
  recordingFinalize: (sessionId: string) => Promise<{
    filePath:        string
    durationSamples: number
    sampleRate:      number
    channelCount:    number
    takeNumber:      number
  } | null>
  recordingAbort:    (sessionId: string) => Promise<void>
  recordingList:     () => Promise<string[]>
  recordingDelete:   (filename: string) => Promise<void>
  recordingReadPcm:  (filePath: string) => Promise<number[]>
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ─── File System Access API (not yet in TS lib.dom) ───────────────────────

interface FileSystemDirectoryHandle extends FileSystemHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  values(): AsyncIterableIterator<FileSystemHandle>
  keys(): AsyncIterableIterator<string>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
}

interface ShowDirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: string | FileSystemHandle
}

interface Window {
  electronAPI?: ElectronAPI
  showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}

// ─── ipcClient.ts ─────────────────────────────────────────────────────────────
// Typed, safe wrapper around window.electronAPI.
// Every method uses optional chaining so callers never need to guard for
// the absence of the preload bridge (browser dev-mode, tests, etc.).
// No `any` types, no throws — every fallback returns a sensible typed value.

const noop = (): void => undefined
const resolveVoid = (): Promise<void> => Promise.resolve()

/** Convenience: return the API object if present, undefined otherwise */
function api(): ElectronAPI | undefined {
  return window.electronAPI
}

export const ipc = {
  // ── Window controls ────────────────────────────────────────────────────────
  minimize: (): Promise<void> => api()?.minimize() ?? resolveVoid(),
  maximize: (): Promise<void> => api()?.maximize() ?? resolveVoid(),
  close: (): Promise<void> => api()?.close() ?? resolveVoid(),
  isMaximized: (): Promise<boolean> => api()?.isMaximized() ?? Promise.resolve(false),
  setAlwaysOnTop: (flag: boolean): Promise<void> =>
    api()?.setAlwaysOnTop(flag) ?? resolveVoid(),
  openExternal: (url: string): Promise<void> =>
    api()?.openExternal(url) ?? resolveVoid(),
  getSystemInfo: (): Promise<Record<string, unknown>> =>
    api()?.getSystemInfo() ?? Promise.resolve({}),

  // ── Updater ────────────────────────────────────────────────────────────────
  checkUpdate: (): Promise<unknown> => api()?.checkUpdate() ?? Promise.resolve(null),
  downloadUpdate: (): Promise<void> => api()?.downloadUpdate() ?? resolveVoid(),
  installUpdate: (): Promise<void> => api()?.installUpdate() ?? resolveVoid(),
  getVersion: (): Promise<string> => api()?.getVersion() ?? Promise.resolve('0.0.0'),

  // ── MIDI ───────────────────────────────────────────────────────────────────
  getMidiDevices: (): Promise<{ inputs: string[]; outputs: string[] }> =>
    api()?.getMidiDevices() ?? Promise.resolve({ inputs: [], outputs: [] }),

  // ── Legacy VST scan ────────────────────────────────────────────────────────
  scanVSTPlugins: (): Promise<unknown[]> =>
    api()?.scanVSTPlugins() ?? Promise.resolve([]),
  getVSTPlugins: (): Promise<unknown[]> =>
    api()?.getVSTPlugins() ?? Promise.resolve([]),

  // ── Project file I/O ───────────────────────────────────────────────────────
  saveProject: (data: unknown): Promise<string | null> =>
    api()?.saveProject(data) ?? Promise.resolve(null),
  loadProject: (): Promise<unknown> =>
    api()?.loadProject() ?? Promise.resolve(null),

  // ── Offline store ──────────────────────────────────────────────────────────
  offlineSave: (id: string, data: unknown): Promise<void> =>
    api()?.offlineSave(id, data) ?? resolveVoid(),
  offlineLoad: (id: string): Promise<unknown> =>
    api()?.offlineLoad(id) ?? Promise.resolve(null),
  offlineList: (): Promise<string[]> =>
    api()?.offlineList() ?? Promise.resolve([]),
  offlineDelete: (id: string): Promise<void> =>
    api()?.offlineDelete(id) ?? resolveVoid(),

  // ── Settings ───────────────────────────────────────────────────────────────
  saveSetting: (key: string, val: unknown): Promise<void> =>
    api()?.saveSetting(key, val) ?? resolveVoid(),
  loadSetting: (key: string): Promise<unknown> =>
    api()?.loadSetting(key) ?? Promise.resolve(null),
  settingsGet: (key: string): Promise<unknown> =>
    api()?.settingsGet(key) ?? Promise.resolve(null),
  settingsSet: (key: string, val: unknown): Promise<void> =>
    api()?.settingsSet(key, val) ?? resolveVoid(),
  settingsGetAll: (): Promise<Record<string, unknown>> =>
    api()?.settingsGetAll() ?? Promise.resolve({}),
  settingsReset: (key: string): Promise<void> =>
    api()?.settingsReset(key) ?? resolveVoid(),

  // ── Autosave ───────────────────────────────────────────────────────────────
  autosaveSaveNow: (data: unknown): Promise<{ savedAt: string }> =>
    api()?.autosaveSaveNow(data) ??
    Promise.resolve({ savedAt: new Date().toISOString() }),
  autosaveLoadLatest: (): Promise<unknown> =>
    api()?.autosaveLoadLatest() ?? Promise.resolve(null),
  autosaveListVersions: (): Promise<{ filename: string; savedAt: string; sizeBytes: number }[]> =>
    api()?.autosaveListVersions() ?? Promise.resolve([]),
  autosaveGetVersion: (filename: string): Promise<unknown> =>
    api()?.autosaveGetVersion(filename) ?? Promise.resolve(null),
  autosaveDeleteVersion: (filename: string): Promise<void> =>
    api()?.autosaveDeleteVersion(filename) ?? resolveVoid(),

  // ── Crash / recovery ───────────────────────────────────────────────────────
  crashCheck: (): Promise<{ hadCrash: boolean; checkpoint: unknown }> =>
    api()?.crashCheck() ?? Promise.resolve({ hadCrash: false, checkpoint: null }),
  crashSaveCheckpoint: (data: unknown): Promise<void> =>
    api()?.crashSaveCheckpoint(data) ?? resolveVoid(),
  crashClearCheckpoint: (): Promise<void> =>
    api()?.crashClearCheckpoint() ?? resolveVoid(),

  // ── Audio settings ─────────────────────────────────────────────────────────
  getAudioDevices: (): Promise<{ inputs: unknown[]; outputs: unknown[] }> =>
    api()?.getAudioDevices() ?? Promise.resolve({ inputs: [], outputs: [] }),
  getAudioSettings: (): Promise<Record<string, unknown>> =>
    api()?.getAudioSettings() ?? Promise.resolve({}),
  setAudioSettings: (s: unknown): Promise<void> =>
    api()?.setAudioSettings(s) ?? resolveVoid(),
  audioDetectDrivers: (): Promise<unknown[]> =>
    api()?.audioDetectDrivers() ?? Promise.resolve([]),
  audioDetectDevices: (): Promise<unknown[]> =>
    api()?.audioDetectDevices() ?? Promise.resolve([]),
  audioSetDriver: (driver: string, device: string): Promise<void> =>
    api()?.audioSetDriver(driver, device) ?? resolveVoid(),
  audioSetBufferSize: (frames: number): Promise<void> =>
    api()?.audioSetBufferSize(frames) ?? resolveVoid(),
  audioSetSampleRate: (rate: number): Promise<void> =>
    api()?.audioSetSampleRate(rate) ?? resolveVoid(),
  audioQueryDevices: (): Promise<void> =>
    api()?.audioQueryDevices() ?? resolveVoid(),
  audioGetLatency: (): Promise<{ bufferFrames: number; sampleRate: number; bufferMs: number; estimatedRoundTripMs: number }> =>
    api()?.audioGetLatency() ?? Promise.resolve({ bufferFrames: 512, sampleRate: 44100, bufferMs: 11.6, estimatedRoundTripMs: 28.2 }),

  // ── File dialogs / file I/O ────────────────────────────────────────────────
  openFileDialog: (opts: unknown): Promise<string[] | null> =>
    api()?.openFileDialog(opts) ?? Promise.resolve(null),
  saveFileDialog: (opts: unknown): Promise<string | null> =>
    api()?.saveFileDialog(opts) ?? Promise.resolve(null),
  readFile: (p: string): Promise<string | null> =>
    api()?.readFile(p) ?? Promise.resolve(null),
  writeFile: (p: string, content: string): Promise<void> =>
    api()?.writeFile(p, content) ?? resolveVoid(),

  // ── Notifications / debug ──────────────────────────────────────────────────
  showNotification: (title: string, body: string): Promise<void> =>
    api()?.showNotification(title, body) ?? resolveVoid(),
  debugGetBuildInfo: (): Promise<Record<string, unknown>> =>
    api()?.debugGetBuildInfo() ?? Promise.resolve({}),
  debugOpenDevTools: (): Promise<void> =>
    api()?.debugOpenDevTools() ?? resolveVoid(),

  // ── Event listeners (renderer ← main) ─────────────────────────────────────
  onNav: (cb: (view: string) => void): void =>
    api()?.onNav(cb) ?? noop(),
  onTriggerSave: (cb: () => void): void =>
    api()?.onTriggerSave(cb) ?? noop(),
  onTriggerLoad: (cb: () => void): void =>
    api()?.onTriggerLoad(cb) ?? noop(),
  onMenuAction: (cb: (action: string) => void): void =>
    api()?.onMenuAction(cb) ?? noop(),
  onPowerEvent: (cb: (event: string) => void): void =>
    api()?.onPowerEvent(cb) ?? noop(),
  onCrashRecoveryAvailable: (cb: (info: unknown) => void): void =>
    api()?.onCrashRecoveryAvailable(cb) ?? noop(),
  onUpdateChecking: (cb: (info: unknown) => void): void =>
    api()?.onUpdateChecking(cb) ?? noop(),
  onUpdateAvailable: (cb: (info: unknown) => void): void =>
    api()?.onUpdateAvailable(cb) ?? noop(),
  onUpdateNotAvailable: (cb: (info: unknown) => void): void =>
    api()?.onUpdateNotAvailable(cb) ?? noop(),
  onUpdateProgress: (cb: (info: unknown) => void): void =>
    api()?.onUpdateProgress(cb) ?? noop(),
  onUpdateDownloaded: (cb: (info: unknown) => void): void =>
    api()?.onUpdateDownloaded(cb) ?? noop(),
  onUpdateError: (cb: (info: unknown) => void): void =>
    api()?.onUpdateError(cb) ?? noop(),
  onUpdateIntegrityReady: (cb: (info: unknown) => void): void =>
    api()?.onUpdateIntegrityReady(cb) ?? noop(),
  removeAllListeners: (channel: string): void =>
    api()?.removeAllListeners(channel) ?? noop(),

  // ── Version / rollback ─────────────────────────────────────────────────────
  versionHistory: (): Promise<unknown> =>
    api()?.versionHistory() ?? Promise.resolve([]),
  versionCanRollback: (): Promise<boolean> =>
    api()?.versionCanRollback() ?? Promise.resolve(false),
  versionRollback: (): Promise<{ ok: boolean; reason?: string }> =>
    api()?.versionRollback() ?? Promise.resolve({ ok: false, reason: 'unavailable' }),
  verifyUpdateFile: (filePath: string, sha256: string): Promise<unknown> =>
    api()?.verifyUpdateFile(filePath, sha256) ?? Promise.resolve(null),

  // ── Plugin (sandboxed host) ────────────────────────────────────────────────
  pluginScan: (): Promise<unknown[]> =>
    api()?.pluginScan() ?? Promise.resolve([]),
  pluginLoad: (
    path: string,
    format: string,
  ): Promise<{ instanceId: string; name: string; vendor: string; paramCount: number; pid: number; latencySamples?: number }> =>
    api()?.pluginLoad(path, format) ??
    Promise.resolve({ instanceId: '', name: '', vendor: '', paramCount: 0, pid: 0 }),
  pluginUnload: (instanceId: string): Promise<{ ok: boolean }> =>
    api()?.pluginUnload(instanceId) ?? Promise.resolve({ ok: false }),
  pluginGetInstances: (): Promise<unknown[]> =>
    api()?.pluginGetInstances() ?? Promise.resolve([]),
  pluginGetBlacklist: (): Promise<{ path: string; name: string; crashCount: number; blacklistedAt: number | null }[]> =>
    api()?.pluginGetBlacklist() ?? Promise.resolve([]),
  pluginRemoveFromBlacklist: (path: string): Promise<{ ok: boolean }> =>
    api()?.pluginRemoveFromBlacklist(path) ?? Promise.resolve({ ok: false }),
  pluginListPresets: (pluginId: string): Promise<{ id: string; name: string; savedAt: number; isFactory: boolean }[]> =>
    api()?.pluginListPresets(pluginId) ?? Promise.resolve([]),
  pluginSavePreset: (
    pluginId: string,
    name: string,
    data: Record<string, number>,
  ): Promise<{ id: string; name: string }> =>
    api()?.pluginSavePreset(pluginId, name, data) ?? Promise.resolve({ id: '', name }),
  pluginLoadPreset: (
    pluginId: string,
    presetId: string,
  ): Promise<{ data: Record<string, number> } | null> =>
    api()?.pluginLoadPreset(pluginId, presetId) ?? Promise.resolve(null),
  pluginDeletePreset: (pluginId: string, presetId: string): Promise<{ ok: boolean }> =>
    api()?.pluginDeletePreset(pluginId, presetId) ?? Promise.resolve({ ok: false }),
  pluginRenamePreset: (
    pluginId: string,
    presetId: string,
    name: string,
  ): Promise<{ name: string } | null> =>
    api()?.pluginRenamePreset(pluginId, presetId, name) ?? Promise.resolve(null),
  pluginSetParameter: (
    instanceId: string,
    paramId: number,
    value: number,
  ): Promise<{ ok: boolean }> =>
    api()?.pluginSetParameter(instanceId, paramId, value) ?? Promise.resolve({ ok: false }),
  pluginGetParameter: (
    instanceId: string,
    paramId: number,
  ): Promise<{ value: number } | null> =>
    api()?.pluginGetParameter(instanceId, paramId) ?? Promise.resolve(null),
  pluginAddToChain: (instanceId: string, trackId: string): Promise<{ ok: boolean }> =>
    api()?.pluginAddToChain(instanceId, trackId) ?? Promise.resolve({ ok: false }),
  pluginRemoveFromChain: (instanceId: string, trackId: string): Promise<{ ok: boolean }> =>
    api()?.pluginRemoveFromChain(instanceId, trackId) ?? Promise.resolve({ ok: false }),
  pluginSetMidiRoute: (
    instanceId: string,
    fromTrackId: string,
    channel: number,
    deviceId?: string,
  ): Promise<{ ok: boolean }> =>
    api()?.pluginSetMidiRoute(instanceId, fromTrackId, channel, deviceId) ??
    Promise.resolve({ ok: false }),
  pluginGetAudioRoutes: (): Promise<unknown[]> =>
    api()?.pluginGetAudioRoutes() ?? Promise.resolve([]),
  pluginGetHealth: (): Promise<unknown[]> =>
    api()?.pluginGetHealth() ?? Promise.resolve([]),
  pluginGetInstanceHealth: (
    instanceId: string,
  ): Promise<{ memoryMb: number; cpuPercent: number; uptimeMs: number } | null> =>
    api()?.pluginGetInstanceHealth(instanceId) ?? Promise.resolve(null),
  pluginHotReload: (instanceId: string): Promise<{ ok: boolean }> =>
    api()?.pluginHotReload(instanceId) ?? Promise.resolve({ ok: false }),
  pluginSaveState: (
    instanceId: string,
    pluginPath: string,
    format: string,
    parameters: Record<string, number>,
    trackId?: string,
  ): Promise<{ ok: boolean }> =>
    api()?.pluginSaveState(instanceId, pluginPath, format, parameters, trackId) ??
    Promise.resolve({ ok: false }),
  pluginGetRecoveredId: (
    oldInstanceId: string,
  ): Promise<{ newInstanceId: string | null }> =>
    api()?.pluginGetRecoveredId(oldInstanceId) ?? Promise.resolve({ newInstanceId: null }),
  pluginScanClearCache: (): Promise<void> =>
    api()?.pluginScanClearCache() ?? resolveVoid(),
  pluginScanCleanupCache: (): Promise<{ removed: number }> =>
    api()?.pluginScanCleanupCache() ?? Promise.resolve({ removed: 0 }),
  pluginScanCacheStats: (): Promise<unknown> =>
    api()?.pluginScanCacheStats() ?? Promise.resolve(null),

  // Plugin events
  onPluginCrashed: (
    cb: (info: {
      instanceId: string
      pluginPath: string
      pluginName: string
      crashCount: number
      blacklisted: boolean
    }) => void,
  ): void => api()?.onPluginCrashed(cb) ?? noop(),
  onPluginRecovered: (
    cb: (info: { oldInstanceId: string; newInstanceId: string; pluginPath: string }) => void,
  ): void => api()?.onPluginRecovered(cb) ?? noop(),
  onPluginRecoveryFailed: (cb: (info: unknown) => void): void =>
    api()?.onPluginRecoveryFailed(cb) ?? noop(),
  onPluginRecoveryAbandoned: (cb: (info: unknown) => void): void =>
    api()?.onPluginRecoveryAbandoned(cb) ?? noop(),
  onPluginResourceWarning: (cb: (info: unknown) => void): void =>
    api()?.onPluginResourceWarning(cb) ?? noop(),

  // ── Perf / autosave (perf: namespace) ─────────────────────────────────────
  perfGetMemoryMetrics: (): Promise<{ heapUsedMB: number; heapTotalMB: number; rssMB: number }> =>
    api()?.perfGetMemoryMetrics() ??
    Promise.resolve({ heapUsedMB: 0, heapTotalMB: 0, rssMB: 0 }),
  perfGetCpuMetrics: (): Promise<{ userMs: number; systemMs: number }> =>
    api()?.perfGetCpuMetrics() ?? Promise.resolve({ userMs: 0, systemMs: 0 }),
  perfAutosaveSave: (data: unknown): Promise<{ savedAt: string }> =>
    api()?.perfAutosaveSave(data) ??
    Promise.resolve({ savedAt: new Date().toISOString() }),
  perfAutosaveLoadLatest: (): Promise<unknown> =>
    api()?.perfAutosaveLoadLatest() ?? Promise.resolve(null),
  perfAutosaveListVersions: (): Promise<{ filename: string; savedAt: string; sizeBytes: number }[]> =>
    api()?.perfAutosaveListVersions() ?? Promise.resolve([]),
  perfAutosaveGetVersion: (filename: string): Promise<unknown> =>
    api()?.perfAutosaveGetVersion(filename) ?? Promise.resolve(null),
  perfCrashWriteMarker: (sessionId: string): Promise<void> =>
    api()?.perfCrashWriteMarker(sessionId) ?? resolveVoid(),
  perfCrashHasMarker: (sessionId: string): Promise<boolean> =>
    api()?.perfCrashHasMarker(sessionId) ?? Promise.resolve(false),
  perfCrashClearMarker: (sessionId: string): Promise<void> =>
    api()?.perfCrashClearMarker(sessionId) ?? resolveVoid(),
  perfCrashListMarkers: (): Promise<string[]> =>
    api()?.perfCrashListMarkers() ?? Promise.resolve([]),

  // ── Mixer detachable window ────────────────────────────────────────────────
  mixerOpenWindow: (): Promise<void> => api()?.mixerOpenWindow() ?? resolveVoid(),
  mixerCloseWindow: (): Promise<void> => api()?.mixerCloseWindow() ?? resolveVoid(),

  // ── Sample browser ─────────────────────────────────────────────────────────
  samplesGetRootDirs: (): Promise<string[]> =>
    api()?.samplesGetRootDirs() ?? Promise.resolve([]),
  samplesAddRootDir: (): Promise<string | null> =>
    api()?.samplesAddRootDir() ?? Promise.resolve(null),
  samplesRemoveRootDir: (dir: string): Promise<void> =>
    api()?.samplesRemoveRootDir(dir) ?? resolveVoid(),
  samplesRescan: (dir: string): Promise<number> =>
    api()?.samplesRescan(dir) ?? Promise.resolve(0),
  samplesSearch: (
    query: string,
    opts?: { type?: string; favorite?: boolean; tags?: string[] },
  ): Promise<SampleRecord[]> =>
    api()?.samplesSearch(query, opts) ?? Promise.resolve([]),
  samplesListDir: (
    dir: string,
  ): Promise<{ name: string; isDir: boolean; hasChildren: boolean }[]> =>
    api()?.samplesListDir(dir) ?? Promise.resolve([]),
  samplesGetRecord: (id: string): Promise<SampleRecord | null> =>
    api()?.samplesGetRecord(id) ?? Promise.resolve(null),
  samplesSetFavorite: (id: string, on: boolean): Promise<void> =>
    api()?.samplesSetFavorite(id, on) ?? resolveVoid(),
  samplesAddTag: (id: string, tag: string): Promise<void> =>
    api()?.samplesAddTag(id, tag) ?? resolveVoid(),
  samplesRemoveTag: (id: string, tag: string): Promise<void> =>
    api()?.samplesRemoveTag(id, tag) ?? resolveVoid(),
  samplesGetAllTags: (): Promise<string[]> =>
    api()?.samplesGetAllTags() ?? Promise.resolve([]),
  samplesGetStats: (): Promise<{ totalRecords: number; favorites: number; rootDirs: number; indexedAt: number }> =>
    api()?.samplesGetStats() ??
    Promise.resolve({ totalRecords: 0, favorites: 0, rootDirs: 0, indexedAt: 0 }),

  // Collections
  samplesListCollections: (): Promise<SampleCollection[]> =>
    api()?.samplesListCollections() ?? Promise.resolve([]),
  samplesCreateCollection: (name: string): Promise<SampleCollection> =>
    api()?.samplesCreateCollection(name) ??
    Promise.resolve({ id: '', name, sampleIds: [], createdAt: Date.now(), updatedAt: Date.now() }),
  samplesDeleteCollection: (id: string): Promise<void> =>
    api()?.samplesDeleteCollection(id) ?? resolveVoid(),
  samplesAddToCollection: (collId: string, sampleId: string): Promise<void> =>
    api()?.samplesAddToCollection(collId, sampleId) ?? resolveVoid(),
  samplesRemoveFromCollection: (collId: string, sampleId: string): Promise<void> =>
    api()?.samplesRemoveFromCollection(collId, sampleId) ?? resolveVoid(),

  // Smart folders
  samplesListSmartFolders: (): Promise<SmartFolder[]> =>
    api()?.samplesListSmartFolders() ?? Promise.resolve([]),
  samplesCreateSmartFolder: (
    name: string,
    query: string,
    opts: unknown,
  ): Promise<SmartFolder> =>
    api()?.samplesCreateSmartFolder(name, query, opts) ??
    Promise.resolve({
      id: '',
      name,
      query,
      type: null,
      favorite: null,
      tags: [],
      createdAt: Date.now(),
    }),
  samplesDeleteSmartFolder: (id: string): Promise<void> =>
    api()?.samplesDeleteSmartFolder(id) ?? resolveVoid(),

  // Sample scan events
  onSamplesScanProgress: (cb: (info: unknown) => void): void =>
    api()?.onSamplesScanProgress(cb) ?? noop(),
  onSamplesScanComplete: (cb: (info: unknown) => void): void =>
    api()?.onSamplesScanComplete(cb) ?? noop(),

  // ── Recording IPC ──────────────────────────────────────────────────────────
  recordingStart: (opts: {
    trackId: string
    takeNumber: number
    format: 'wav' | 'flac'
    sampleRate: number
    channelCount: number
    bitDepth: 16 | 24 | 32
  }): Promise<{ sessionId: string }> =>
    api()?.recordingStart(opts) ?? Promise.resolve({ sessionId: '' }),
  recordingChunk: (payload: { sessionId: string; data: number[] }): Promise<void> =>
    api()?.recordingChunk(payload) ?? resolveVoid(),
  recordingFinalize: (
    sessionId: string,
  ): Promise<{
    filePath: string
    durationSamples: number
    sampleRate: number
    channelCount: number
    takeNumber: number
  } | null> =>
    api()?.recordingFinalize(sessionId) ?? Promise.resolve(null),
  recordingAbort: (sessionId: string): Promise<void> =>
    api()?.recordingAbort(sessionId) ?? resolveVoid(),
  recordingList: (): Promise<string[]> =>
    api()?.recordingList() ?? Promise.resolve([]),
  recordingDelete: (filename: string): Promise<void> =>
    api()?.recordingDelete(filename) ?? resolveVoid(),
  recordingReadPcm: (filePath: string): Promise<number[]> =>
    api()?.recordingReadPcm(filePath) ?? Promise.resolve([]),

  // ── Safety system ──────────────────────────────────────────────────────────
  safetySave: (
    json: string,
    projectId: string,
    projectName: string,
  ): Promise<unknown> =>
    api()?.safetySave(json, projectId, projectName) ?? Promise.resolve({ ok: true }),
  safetyCheckRecovery: (): Promise<{ hasCrashRecovery: boolean; snapshots: unknown[] }> =>
    api()?.safetyCheckRecovery() ??
    Promise.resolve({ hasCrashRecovery: false, snapshots: [] }),
  safetyRestoreSnapshot: (id: string): Promise<string | null> =>
    api()?.safetyRestoreSnapshot(id) ?? Promise.resolve(null),
  safetyDiscardRecovery: (): Promise<void> =>
    api()?.safetyDiscardRecovery() ?? resolveVoid(),
  safetyListBackups: (): Promise<unknown[]> =>
    api()?.safetyListBackups() ?? Promise.resolve([]),
  safetyDeleteBackup: (id: string): Promise<void> =>
    api()?.safetyDeleteBackup(id) ?? resolveVoid(),
  safetyMarkClean: (): Promise<void> =>
    api()?.safetyMarkClean() ?? resolveVoid(),

  // ── Export system ──────────────────────────────────────────────────────────
  exportCheckFfmpeg: (): Promise<boolean> =>
    api()?.exportCheckFfmpeg() ?? Promise.resolve(false),
  exportTranscode: (
    opts: unknown,
  ): Promise<{ success: boolean; data?: number[]; error?: string; codec?: string }> =>
    api()?.exportTranscode(opts) ?? Promise.resolve({ success: false }),
  exportWriteFile: (
    filePath: string,
    bytes: number[],
  ): Promise<{ success: boolean; error?: string }> =>
    api()?.exportWriteFile(filePath, bytes) ?? Promise.resolve({ success: false }),

  // ── AI (optional) ──────────────────────────────────────────────────────────
  aiProcessCommand: (ctx: string, cmd: string): Promise<unknown> =>
    api()?.aiProcessCommand?.(ctx, cmd) ?? Promise.resolve(null),

  // ── Diagnostic (optional) ──────────────────────────────────────────────────
  diagnosticLog: (
    level: string,
    category: string,
    msg: string,
    data?: unknown,
  ): Promise<void> =>
    api()?.diagnosticLog?.(level, category, msg, data) ?? resolveVoid(),
  diagnosticRead: (maxLines?: number): Promise<unknown[]> =>
    api()?.diagnosticRead?.(maxLines) ?? Promise.resolve([]),
  diagnosticGenerateReport: (): Promise<unknown> =>
    api()?.diagnosticGenerateReport?.() ?? Promise.resolve(null),
  diagnosticClear: (): Promise<void> =>
    api()?.diagnosticClear?.() ?? resolveVoid(),

  // ── VST3 professional system ───────────────────────────────────────────────
  vstScan: (): Promise<unknown> => api()?.vstScan() ?? Promise.resolve(null),
  vstList: (): Promise<unknown[]> => api()?.vstList() ?? Promise.resolve([]),
  vstSearch: (query: string): Promise<unknown[]> =>
    api()?.vstSearch(query) ?? Promise.resolve([]),
  vstLoadInstance: (pluginId: string): Promise<string> =>
    api()?.vstLoadInstance(pluginId) ?? Promise.resolve(''),
  vstUnloadInstance: (instanceId: string): Promise<void> =>
    api()?.vstUnloadInstance(instanceId) ?? resolveVoid(),
  vstSetParameter: (
    instanceId: string,
    paramIndex: number,
    value: number,
  ): Promise<void> =>
    api()?.vstSetParameter(instanceId, paramIndex, value) ?? resolveVoid(),
  vstGetParameter: (instanceId: string, paramIndex: number): Promise<number> =>
    api()?.vstGetParameter(instanceId, paramIndex) ?? Promise.resolve(0),
  vstGetAllParameters: (instanceId: string): Promise<unknown[]> =>
    api()?.vstGetAllParameters(instanceId) ?? Promise.resolve([]),
  vstGetState: (instanceId: string): Promise<number[]> =>
    api()?.vstGetState(instanceId) ?? Promise.resolve([]),
  vstSetState: (instanceId: string, state: number[]): Promise<void> =>
    api()?.vstSetState(instanceId, state) ?? resolveVoid(),
  vstSendMidi: (instanceId: string, event: unknown): Promise<void> =>
    api()?.vstSendMidi(instanceId, event) ?? resolveVoid(),
  vstGetPresets: (instanceId: string): Promise<unknown[]> =>
    api()?.vstGetPresets(instanceId) ?? Promise.resolve([]),
  vstLoadPreset: (instanceId: string, presetId: string): Promise<void> =>
    api()?.vstLoadPreset(instanceId, presetId) ?? resolveVoid(),
  vstBypass: (instanceId: string, bypassed: boolean): Promise<void> =>
    api()?.vstBypass(instanceId, bypassed) ?? resolveVoid(),
  vstSearchAdvanced: (query: string, filters: unknown): Promise<unknown[]> =>
    api()?.vstSearchAdvanced(query, filters) ?? Promise.resolve([]),
  vstOpenWindow: (instanceId: string, pluginName: string): Promise<unknown> =>
    api()?.vstOpenWindow(instanceId, pluginName) ?? Promise.resolve(null),
  vstCloseWindow: (instanceId: string): Promise<void> =>
    api()?.vstCloseWindow(instanceId) ?? resolveVoid(),
  vstResizeWindow: (instanceId: string, w: number, h: number): Promise<void> =>
    api()?.vstResizeWindow(instanceId, w, h) ?? resolveVoid(),
  vstPinWindow: (instanceId: string, pinned: boolean): Promise<void> =>
    api()?.vstPinWindow(instanceId, pinned) ?? resolveVoid(),
  vstAddFavorite: (pluginId: string): Promise<unknown> =>
    api()?.vstAddFavorite(pluginId) ?? Promise.resolve(null),
  vstRemoveFavorite: (pluginId: string): Promise<unknown> =>
    api()?.vstRemoveFavorite(pluginId) ?? Promise.resolve(null),
  vstGetFavorites: (): Promise<unknown[]> =>
    api()?.vstGetFavorites() ?? Promise.resolve([]),
  vstAddTag: (pluginId: string, tag: string): Promise<unknown> =>
    api()?.vstAddTag(pluginId, tag) ?? Promise.resolve(null),
  vstRemoveTag: (pluginId: string, tag: string): Promise<unknown> =>
    api()?.vstRemoveTag(pluginId, tag) ?? Promise.resolve(null),
  vstGetAllTags: (): Promise<unknown> =>
    api()?.vstGetAllTags() ?? Promise.resolve([]),
  vstCreateCollection: (name: string): Promise<unknown> =>
    api()?.vstCreateCollection(name) ?? Promise.resolve(null),
  vstAddToCollection: (collId: string, pluginId: string): Promise<unknown> =>
    api()?.vstAddToCollection(collId, pluginId) ?? Promise.resolve(null),
  vstRemoveFromCollection: (collId: string, pluginId: string): Promise<unknown> =>
    api()?.vstRemoveFromCollection(collId, pluginId) ?? Promise.resolve(null),
  vstGetCollections: (): Promise<unknown[]> =>
    api()?.vstGetCollections() ?? Promise.resolve([]),
  vstOnScanProgress: (cb: (p: unknown) => void): (() => void) =>
    api()?.vstOnScanProgress(cb) ?? noop,

  // ── Platform info ──────────────────────────────────────────────────────────
  get platform(): string {
    return api()?.platform ?? ''
  },
  get isElectron(): boolean {
    return api()?.isElectron === true
  },
} as const

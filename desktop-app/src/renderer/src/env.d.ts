/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  setAlwaysOnTop: (flag: boolean) => Promise<void>
  openExternal: (url: string) => Promise<void>
  getSystemInfo: () => Promise<Record<string, unknown>>
  checkUpdate: () => Promise<unknown>
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
  autosaveListVersions: () => Promise<string[]>
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
  onNav: (cb: (view: string) => void) => void
  onTriggerSave: (cb: () => void) => void
  onTriggerLoad: (cb: () => void) => void
  onMenuAction: (cb: (action: string) => void) => void
  onPowerEvent: (cb: (event: string) => void) => void
  onUpdateAvailable: (cb: (info: unknown) => void) => void
  removeAllListeners: (channel: string) => void
  platform: string
  isElectron: true
}

interface Window {
  electronAPI?: ElectronAPI
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

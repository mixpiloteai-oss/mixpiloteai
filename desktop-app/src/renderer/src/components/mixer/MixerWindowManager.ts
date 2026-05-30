// ─── MixerWindowManager.ts ───────────────────────────────────────────────────
// Controls the detachable mixer BrowserWindow via Electron IPC.

export class MixerWindowManager {
  private _isOpen = false

  open(): void {
    if (this._isOpen) return
    if (typeof window !== 'undefined' && window.electronAPI) {
      void window.electronAPI.mixerOpenWindow()
      this._isOpen = true
    }
  }

  close(): void {
    if (!this._isOpen) return
    if (typeof window !== 'undefined' && window.electronAPI) {
      void window.electronAPI.mixerCloseWindow()
      this._isOpen = false
    }
  }

  toggle(): void {
    this._isOpen ? this.close() : this.open()
  }

  isOpen(): boolean {
    return this._isOpen
  }
}

export const mixerWindowManager = new MixerWindowManager()

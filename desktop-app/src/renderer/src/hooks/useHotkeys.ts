/**
 * useHotkeys — mounts global keydown listener and delegates to HotkeyManager.
 */

import { useEffect } from 'react'
import { HotkeyManager } from '../hotkeys/HotkeyManager.ts'

export function useHotkeys(): void {
  useEffect(() => {
    const manager = HotkeyManager.getInstance()

    const onKeyDown = (e: KeyboardEvent): void => {
      const handled = manager.onKeyEvent(e)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])
}

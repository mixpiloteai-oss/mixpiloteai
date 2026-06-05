import { useEffect } from 'react'
import { useHistoryStore } from '../store/historyStore'

/**
 * Mount this hook once at app root level.
 * Binds Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z or Ctrl+Y (redo)
 * to the global history store.
 *
 * Skips the shortcut when focus is inside an input, textarea, or
 * contenteditable element so text editing is unaffected.
 */
export function useGlobalUndo(): void {
  const undo = useHistoryStore((s) => s.undo)
  const redo = useHistoryStore((s) => s.redo)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      // Skip when typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        if (target.isContentEditable) return
      }

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if ((e.key === 'z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [undo, redo])
}

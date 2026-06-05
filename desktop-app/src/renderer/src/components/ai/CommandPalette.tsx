// ─── CommandPalette.tsx ───────────────────────────────────────────────────────
// Full-screen command palette overlay for AI commands (Cmd/Ctrl+Shift+A).

import { useState, useRef, useEffect } from 'react'
import { useDeepAIStore } from '../../store/deepAIStore'
import type { ProjectSnapshot } from '../../audio/ai/MusicContextEngine'
import type { DeepAIResult } from '../../audio/ai/DeepAIAssistant'

const EXAMPLE_COMMANDS = [
  'fais une montée acid',
  'plus agressif',
  'rends la basse plus propre',
  'ajoute groove tribe',
  'humanize hats',
  'plus de dynamique',
  'add 4-bar buildup',
  'add drop',
  'detect key',
] as const

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  getSnapshot?: () => ProjectSnapshot
}

export default function CommandPalette({ isOpen, onClose, getSnapshot }: CommandPaletteProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<DeepAIResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { processCommand } = useDeepAIStore()

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setInput('')
      setResult(null)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleSubmit = async (text: string) => {
    if (!text.trim() || !getSnapshot) return
    setIsProcessing(true)
    try {
      const snapshot = getSnapshot()
      const r = await processCommand(text.trim(), snapshot)
      setResult(r)
    } catch (err) {
      console.error('[CommandPalette] Error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(input).catch(console.error)
    }
  }

  const handleExampleClick = (cmd: string) => {
    setInput(cmd)
    handleSubmit(cmd).catch(console.error)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-700">
          <span className="text-indigo-400 text-lg">✦</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI..."
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-500"
            disabled={isProcessing}
          />
          {isProcessing && (
            <span className="text-gray-400 text-sm animate-pulse">Thinking...</span>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Examples */}
        {!result && (
          <div className="p-4">
            <div className="text-gray-500 text-xs mb-2">Try these commands:</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_COMMANDS.map(cmd => (
                <button
                  key={cmd}
                  onClick={() => handleExampleClick(cmd)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div className="p-4 space-y-3">
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">✓</span>
                <div className="text-white text-sm font-medium">
                  {result.responseText}
                </div>
              </div>

              {result.plan.description && (
                <div className="text-gray-400 text-xs">
                  Plan: {result.plan.description}
                </div>
              )}

              {result.plan.affectedTracks.length > 0 && (
                <div className="text-gray-500 text-xs">
                  Affects: {result.plan.affectedTracks.join(', ')}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>Confidence: {(result.parsedCommand.confidence * 100).toFixed(0)}%</span>
                <span>Source: {result.source}</span>
                <span>Language: {result.parsedCommand.language}</span>
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setInput(''); inputRef.current?.focus() }}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              ← Ask another question
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

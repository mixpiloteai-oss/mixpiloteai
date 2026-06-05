// ─── LiveAssistantPanel.tsx ───────────────────────────────────────────────────
// Floating live AI suggestion panel with on/off toggle and category filters.

import { useState } from 'react'
import { useDeepAIStore } from '../../store/deepAIStore'
import type { AISuggestion } from '../../audio/ai/LiveSuggestionEngine'
import type { ProjectSnapshot } from '../../audio/ai/MusicContextEngine'

type Category = 'all' | 'arrangement' | 'mixing' | 'sound' | 'groove' | 'harmony'

const TYPE_ICON: Record<string, string> = {
  warning:     '⚠️',
  idea:        '💡',
  fix:         '🔧',
  enhancement: '✨',
}

const PRIORITY_COLOR = (priority: number): string => {
  if (priority >= 0.8) return '#ef4444'
  if (priority >= 0.6) return '#f59e0b'
  return '#10b981'
}

interface LiveAssistantPanelProps {
  getSnapshot?: () => ProjectSnapshot
}

export default function LiveAssistantPanel({ getSnapshot }: LiveAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  const store = useDeepAIStore()
  const { suggestions, isLiveAssistantActive, startLiveAssistant, stopLiveAssistant, processCommand } = store

  const categories: Category[] = ['all', 'arrangement', 'mixing', 'sound', 'groove', 'harmony']

  const filteredSuggestions = suggestions.filter(s =>
    activeCategory === 'all' || s.category === activeCategory
  )

  const handleToggle = () => {
    if (isLiveAssistantActive) {
      stopLiveAssistant()
    } else if (getSnapshot) {
      startLiveAssistant(getSnapshot)
    }
  }

  const handleApply = (suggestion: AISuggestion) => {
    if (!getSnapshot) return
    processCommand(suggestion.command, getSnapshot()).catch(console.error)
  }

  const handleRefresh = async () => {
    if (!getSnapshot) return
    const snapshot = getSnapshot()
    await store.analyzeProject(snapshot)
  }

  return (
    <div
      className="fixed bottom-4 right-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50"
      style={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Live AI Assistant</span>
          {isLiveAssistantActive && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-white text-xs transition-colors"
            title="Refresh suggestions"
          >
            ↻
          </button>
          <button
            onClick={handleToggle}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isLiveAssistantActive
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isLiveAssistantActive ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setIsOpen(v => !v)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isOpen ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Category filters */}
          <div className="flex gap-1 p-2 flex-wrap border-b border-gray-700/50">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-xs capitalize transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Suggestion cards */}
          <div className="p-2 space-y-2">
            {filteredSuggestions.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-4">
                No suggestions yet. Start the live assistant or analyze your project.
              </div>
            ) : (
              filteredSuggestions.slice(0, 6).map(suggestion => (
                <div
                  key={suggestion.id}
                  className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700/50"
                >
                  {/* Priority bar */}
                  <div
                    className="h-0.5 w-full rounded-full"
                    style={{ background: PRIORITY_COLOR(suggestion.priority) }}
                  />

                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">
                      {TYPE_ICON[suggestion.type] ?? '💡'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium leading-tight">
                        {suggestion.title}
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5 leading-snug">
                        {suggestion.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs capitalize">{suggestion.category}</span>
                    <button
                      onClick={() => handleApply(suggestion)}
                      className="px-2 py-0.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

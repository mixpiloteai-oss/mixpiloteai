import { useState, useRef, useEffect } from 'react'
import { useDesktopNetworkStore } from '../../store/networkStore'
import { offlineAIChat } from '../../services/offlineAI'
import { config } from '../../lib/config'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  generating?: boolean
}

const SEED: Message[] = [
  { id: '0', role: 'system',    content: 'AI Assistant ready. Describe what you want to generate.' },
  { id: '1', role: 'user',      content: 'Generate a dark hardtek drop at 145bpm in D minor' },
  { id: '2', role: 'assistant', content: `✓ 8-bar pattern generated in 0.7s

├─ Kick     ████░░██░░░░████░░
├─ Bass     Dm pentatonic · syncopated 16th notes
├─ Lead     Acid sweep · 8 notes · dorian mode
└─ Chords   Dm7 → Am7 → Gm7 progression

Ready to drop into piano roll. Say "add reverb to lead" or "make the bass more aggressive".` },
]

export default function AIAssistant() {
  const [messages, setMessages]   = useState<Message[]>(SEED)
  const [input, setInput]         = useState('')
  const [generating, setGenerating] = useState(false)
  const [token]                   = useState<string | null>(() => localStorage.getItem('token'))
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)
  const { aiAvailable }           = useDesktopNetworkStore()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || generating) return
    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const placeholder: Message = { id: Date.now() + 'a', role: 'assistant', content: '', generating: true }
    setMessages(m => [...m, userMsg, placeholder])
    setGenerating(true)

    // ── Offline fallback: local heuristic AI ──────────────────────────────────
    if (!aiAvailable) {
      const offlineReply = offlineAIChat(text)
      setMessages(m => m.map(msg =>
        msg.generating ? { ...msg, content: offlineReply.text, generating: false } : msg
      ))
      setGenerating(false)
      inputRef.current?.focus()
      return
    }

    try {
      const res = await fetch(`${config.apiUrl}/api/ai/generate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: text, context: 'daw-assistant' }),
        signal: AbortSignal.timeout(20_000),
      })
      const data = await res.json()
      const reply = data?.result ?? data?.content ?? data?.message ?? 'Pattern generated. Check your arrangement.'
      setMessages(m => m.map(msg => msg.generating ? { ...msg, content: reply, generating: false } : msg))
    } catch {
      // Network dropped mid-request — fall back to offline AI
      const fallback = offlineAIChat(text)
      setMessages(m => m.map(msg =>
        msg.generating
          ? { ...msg, content: fallback.text, generating: false }
          : msg
      ))
    } finally {
      setGenerating(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-studio-purple text-sm">✦</span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>AI Assistant</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: '#334155' }}>Claude</span>
        </div>
      </div>

      {/* Suggestions */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0" style={{ borderBottom: '1px solid #13131f' }}>
        {[
          'Dark hardtek 145bpm',
          'Acid bassline in Dm',
          'Add percussion layer',
          'Chord progression for drop',
        ].map(s => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="shrink-0 px-2.5 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors hover:border-studio-purple/40"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'system' && (
              <p className="text-[10px] text-center py-1" style={{ color: '#334155' }}>{msg.content}</p>
            )}
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm text-xs leading-relaxed"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', color: '#c4b5fd' }}>
                  {msg.content}
                </div>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-lg bg-studio-purple/20 flex items-center justify-center text-[9px] shrink-0 mt-0.5" style={{ color: '#7c3aed' }}>✦</div>
                <div className="flex-1 px-3 py-2 rounded-xl rounded-bl-sm text-xs leading-relaxed font-mono whitespace-pre-line"
                  style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#94a3b8' }}>
                  {msg.generating
                    ? <span className="animate-pulse" style={{ color: '#7c3aed' }}>Generating<span className="ml-1">▋</span></span>
                    : msg.content
                  }
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid #1c1c2e' }}>
        <div className="flex gap-2 items-end rounded-xl overflow-hidden"
          style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe what to generate…"
            rows={2}
            className="flex-1 px-3 py-2.5 text-xs resize-none outline-none font-mono leading-relaxed"
            style={{ background: 'transparent', color: '#e2e8f0', caretColor: '#7c3aed' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || generating}
            className="m-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim() && !generating ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
              color:      input.trim() && !generating ? '#a855f7' : '#334155',
              border:     `1px solid ${input.trim() && !generating ? 'rgba(124,58,237,0.4)' : '#1c1c2e'}`,
            }}
          >
            ↑
          </button>
        </div>
        <p className="text-[9px] mt-1.5 px-1" style={{ color: '#1c1c2e' }}>Enter to send · Shift+Enter new line</p>
      </div>
    </div>
  )
}

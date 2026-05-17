// ============================================================
// NEUROTEK AI — AI Coach Component
// Interactive genre-aware coaching chat with plan gating
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Lock, ChevronRight, Loader2, User, Bot, Music, Zap, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiClient as api } from '../services/api';

type CoachGenre = 'mentalcore' | 'hardtek' | 'tribe' | 'acidcore' | 'hardtechno' | 'general';
type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface GenreConfig {
  id: CoachGenre; label: string; bpm: string;
  borderColor: string; bgColor: string; textColor: string; dotColor: string;
}

const GENRES: GenreConfig[] = [
  { id: 'mentalcore', label: 'Mentalcore', bpm: '200–215 BPM', borderColor: 'border-red-500', bgColor: 'bg-red-500/10', textColor: 'text-red-400', dotColor: 'bg-red-500' },
  { id: 'hardtek', label: 'Hardtek', bpm: '175–190 BPM', borderColor: 'border-orange-500', bgColor: 'bg-orange-500/10', textColor: 'text-orange-400', dotColor: 'bg-orange-500' },
  { id: 'tribe', label: 'Tribe', bpm: '145–160 BPM', borderColor: 'border-green-500', bgColor: 'bg-green-500/10', textColor: 'text-green-400', dotColor: 'bg-green-500' },
  { id: 'acidcore', label: 'Acidcore', bpm: '160–180 BPM', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400', dotColor: 'bg-yellow-500' },
  { id: 'hardtechno', label: 'Hard Techno', bpm: '140–150 BPM', borderColor: 'border-purple-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', dotColor: 'bg-purple-500' },
  { id: 'general', label: 'General', bpm: 'All styles', borderColor: 'border-gray-500', bgColor: 'bg-gray-500/10', textColor: 'text-gray-400', dotColor: 'bg-gray-500' },
];

const GENRE_SUGGESTIONS: Record<CoachGenre, string[]> = {
  mentalcore: ['How do I design a mentalcore kick?', 'Best distortion chain for 200 BPM?', 'How to structure a mentalcore set?', 'Sidechain techniques at 210 BPM?'],
  hardtek: ['Design a raw hardtek kick', '303 acid pattern for hardtek', 'How to get the lo-fi hardtek sound?', 'Mixing tips for hardtek'],
  tribe: ['Create a tribal percussion layer', 'How to humanise tribe patterns?', 'Organic textures in Ableton', 'Swing quantisation for tribe'],
  acidcore: ['Extreme 303 acidcore settings', 'Layering acid lines', 'Kick design for acidcore', 'How to make the acid hypnotic?'],
  hardtechno: ['Dark hard techno bass design', 'Industrial atmosphere techniques', 'Arrangement for DJ play', 'Hard techno mixing tips'],
  general: ['Where should I start in tekno production?', 'How to choose my genre?', 'Basic mixdown checklist', 'Explain BPM differences by genre'],
};

const LEVELS: { id: SkillLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-2">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="w-2 h-2 rounded-full bg-cyan-400"
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function PlanGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center gap-4 p-8 text-center max-w-sm"
      >
        <div className="w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
          <Lock className="w-7 h-7 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-white">AI Coach Locked</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          The AI Coach is available on Creator, Studio, and Learning plans. Unlock personalised genre coaching, MIDI advice, and step-by-step tutorials.
        </p>
        <button onClick={onUpgrade}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
        >
          Upgrade to Creator <ChevronRight className="w-4 h-4" />
        </button>
        <p className="text-gray-500 text-xs">Starting at €7/month · Cancel anytime</p>
      </motion.div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: CoachMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-purple-600/30 border border-purple-500/40' : 'bg-cyan-600/20 border border-cyan-500/30'
      }`}>
        {isUser ? <User className="w-4 h-4 text-purple-400" /> : <Bot className="w-4 h-4 text-cyan-400" />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser ? 'bg-purple-700/60 border border-purple-600/40 text-white rounded-tr-sm' : 'bg-gray-800/80 border border-gray-700/60 text-gray-100 rounded-tl-sm'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <p className={`text-xs mt-1.5 ${isUser ? 'text-purple-300/60' : 'text-gray-500'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

export default function AICoach() {
  const { auth, setView } = useAppStore();
  const userPlan = (auth.user as { plan?: string } | null)?.plan ?? 'free';
  const isPlanGated = userPlan === 'free';

  const [selectedGenre, setSelectedGenre] = useState<CoachGenre>('general');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>('beginner');
  const [midiSetup, setMidiSetup] = useState('');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentGenre = GENRES.find((g) => g.id === selectedGenre)!;
  const suggestions = GENRE_SUGGESTIONS[selectedGenre];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => { setMessages([]); setError(null); }, [selectedGenre]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || isPlanGated) return;

    const userMsg: CoachMessage = { id: `msg-${Date.now()}-user`, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/api/coach/chat', { message: trimmed, genre: selectedGenre, level: selectedLevel, midiSetup: midiSetup || undefined, history });
      const reply = data?.data?.response ?? data?.data?.reply ?? data?.reply ?? 'No response received.';
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-assistant`, role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string } } };
      setError(axiosErr?.response?.data?.message ?? axiosErr?.response?.data?.error ?? 'Failed to reach AI Coach. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading, isPlanGated, messages, selectedGenre, selectedLevel, midiSetup]);

  const handleUpgrade = () => {
    setView('plans' as any);
    window.dispatchEvent(new CustomEvent('neurotek:navigate', { detail: 'plans' }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex-shrink-0 border-b border-gray-800/60 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <h1 className="text-lg font-bold text-white">AI Coach</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">BETA</span>
        </div>
        <p className="text-gray-400 text-sm ml-11">Genre-specific coaching, techniques &amp; production advice</p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800/40 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Music className="w-3.5 h-3.5" /> Genre
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g.id} onClick={() => setSelectedGenre(g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                    selectedGenre === g.id ? `${g.borderColor} ${g.bgColor} ${g.textColor}` : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedGenre === g.id ? g.dotColor : 'bg-gray-600'}`} />
                  {g.label}
                  {selectedGenre === g.id && <span className="text-gray-500 font-normal ml-1">· {g.bpm}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Level</p>
              <div className="flex rounded-lg overflow-hidden border border-gray-700 bg-gray-800/40">
                {LEVELS.map((lvl) => (
                  <button key={lvl.id} onClick={() => setSelectedLevel(lvl.id)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                      selectedLevel === lvl.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/40'
                    }`}
                  >{lvl.label}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Setup <span className="text-gray-600 font-normal normal-case">(optional)</span></p>
              <input type="text" value={midiSetup} onChange={(e) => setMidiSetup(e.target.value)}
                placeholder="e.g. Ableton 11, Roland TR-8S, no MIDI keyboard"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors"
                disabled={isPlanGated}
              />
            </div>
          </div>
        </div>

        <div className="relative flex-1 flex flex-col overflow-hidden">
          {isPlanGated && <PlanGate onUpgrade={handleUpgrade} />}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {messages.length === 0 && !isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-12 gap-4"
              >
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${currentGenre.borderColor} ${currentGenre.bgColor}`}>
                  <Bot className={`w-7 h-7 ${currentGenre.textColor}`} />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{currentGenre.label} Coach ready</h3>
                  <p className="text-gray-500 text-sm max-w-xs">Ask anything about {currentGenre.label} production — kicks, basslines, arrangement, mix tips, and more.</p>
                </div>
              </motion.div>
            )}
            <AnimatePresence>{messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}</AnimatePresence>
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 flex-row">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                </div>
                <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl rounded-tl-sm px-4 py-3">
                  <TypingDots />
                </div>
              </motion.div>
            )}
            {error && !isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!isPlanGated && (
            <div className="flex-shrink-0 px-6 py-2 border-t border-gray-800/40">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all duration-150 whitespace-nowrap ${currentGenre.borderColor} ${currentGenre.bgColor} ${currentGenre.textColor} hover:opacity-80`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800/60">
            <div className="flex items-end gap-3">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={isPlanGated ? 'Upgrade to use AI Coach…' : `Ask your ${currentGenre.label} question… (Enter to send)`}
                rows={1} disabled={isPlanGated || isLoading}
                className="flex-1 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] max-h-[120px]"
                style={{ height: 'auto' }}
                onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || isPlanGated}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors duration-200"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">AI can make mistakes — always verify critical production decisions</p>
          </div>
        </div>
      </div>
    </div>
  );
}

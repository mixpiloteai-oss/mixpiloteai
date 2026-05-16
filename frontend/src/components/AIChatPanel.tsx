// ============================================================
// NEUROTEK AI — AI Chat Panel
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Trash2, Zap, Code, ChevronDown, User, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { Button } from './ui/Button';
import { aiApi } from '../services/api';
import type { ChatMessage } from '../types';

const EXAMPLE_PROMPTS = [
  'Generate a mentalcore template at 200 BPM',
  'Suggest an acid 303 pattern for hardtek',
  'How to sidechain bass to kick properly?',
  'Analyse my mix for frequency issues',
  'Best FX chain for tribal percussion?',
  'What BPM range is good for tribe?',
  'How to make a proper distorted kick?',
  'Explain the difference between mentalcore and acidcore',
];

// Fake AI response generator
function generateAIResponse(message: string): ChatMessage {
  const lower = message.toLowerCase();
  let content = '';
  let codeBlock: ChatMessage['codeBlock'] | undefined;
  let suggestions: string[] | undefined;

  if (lower.includes('kick') || lower.includes('kick drum')) {
    content = "For a crushing mentalcore kick, focus on three elements: **transient**, **sub power**, and **harmonic distortion**.\n\n**Quick recipe:**\n1. Start with a 909 or 808 sample\n2. Layer a sine sweep (C2 → C1) underneath for sub\n3. Clip/saturate the transient hard\n4. HP filter the sub-bass below 30Hz\n5. Sidechain everything else to this kick\n\nAt 200 BPM you need every kick to be tight — keep the tail under 200ms or it'll blur into the next hit.";
    codeBlock = {
      language: 'text',
      code: `KICK CHAIN (recommended):\n→ Transient Shaper (Attack: 0ms, Sustain: -8dB)\n→ EQ: +6dB @ 55Hz, -5dB @ 250Hz  \n→ Saturator: Hard Clip, Drive 80%\n→ Limiter: -0.3dBTP ceiling\n→ BUS: Group with sub-kick for SC`,
    };
    suggestions = ['How to layer kick drums?', 'Best sub-kick plugin?', 'Kick sidechain settings?'];
  } else if (lower.includes('template') || lower.includes('generate')) {
    content = "I'll generate a template for you! Head to the **Template Generator** tab where you can select your genre, BPM range, and mood. The AI will create a complete project structure including:\n\n- Track layout with colour-coded lanes\n- Recommended FX chains for each track\n- Signal routing diagram\n- Mixing bus structure\n\nWhat genre are you targeting?";
    suggestions = ['Mentalcore at 200 BPM', 'Hardtek at 145 BPM', 'Tribe at 148 BPM'];
  } else if (lower.includes('acid') || lower.includes('303')) {
    content = "The 303 acid bass is all about the filter envelope. Here's the classic approach:\n\n**Pattern:** 16-step with accent on every 4th or random 1/8th notes\n**Key parameters:**\n- **Cutoff:** 400–2000Hz sweep range\n- **Resonance:** 75–100% (the higher the more mental)\n- **Env Mod:** 60–90%\n- **Decay:** Short (50–100ms) for stabs, long (300ms) for slides\n\n**FX suggestion:** add a 1/8 delay (feedback 30%) and light reverb to make it float in the mix. Sidechain compress against the kick.";
    suggestions = ['303 plugin recommendations', 'How to program acid patterns?', 'Acid in hardtek vs mentalcore'];
  } else if (lower.includes('sidechain') || lower.includes('ducking')) {
    content = "Sidechain compression is essential in mentalcore and hardtek. Here's how to set it up properly:\n\n**Classic pump sidechain:**\n- Source: Kick drum (use a ghost kick if needed)\n- Target: Bass group, pads, FX layers\n- Attack: 0–2ms (instant response)\n- Release: 80–150ms (adjust to BPM feel)\n- Ratio: 6:1 to ∞:1\n- Threshold: -18 to -12dB\n\n**Ghost kick trick:** duplicate your kick, mute it, use it ONLY as the sidechain trigger. Gives cleaner pumping without affecting the main kick mix.";
    codeBlock = {
      language: 'text',
      code: `SIDECHAIN ROUTING:\nKick → [Ghost Copy] → SC Input\n                        ↓\nBass Bus ← Compressor (SC mode)\nPad Bus  ← Compressor (SC mode)  \nFX Bus   ← Volume Shaper (cleaner)`,
    };
    suggestions = ['LFO Tool vs compressor sidechain?', 'Volume shaper for pumping?'];
  } else if (lower.includes('mix') || lower.includes('frequency')) {
    content = "Go to the **Mix Assistant** tab for a real-time analysis of your project. It will identify:\n\n- Frequency conflicts between tracks (e.g. kick vs bass collision at 80Hz)\n- Clipping and loudness issues\n- Volume balance problems\n- Stereo field narrowness\n\n**Common mentalcore mix issues:**\n- Kick and bass fighting in 60–100Hz range → sidechain + HP filter\n- Too much mud at 200–400Hz → surgical EQ cuts\n- Harsh high-mids from distorted kick → 3–5kHz shelf cut";
    suggestions = ['Check my mix now', 'Loudness targets for tek?', 'Mastering chain for hardtek?'];
  } else {
    content = `Good question about **${message}**.\n\nAs a production assistant specialising in mentalcore, hardtek, tribe, and techno, I can help you with:\n\n- **Template generation** for any genre\n- **Mix analysis** and frequency conflict detection\n- **FX chain** recommendations\n- **Sound design** for kicks, bass, acid, and more\n- **Live set** structuring\n\nWhat specific aspect would you like to explore?`;
    suggestions = EXAMPLE_PROMPTS.slice(0, 3);
  }

  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    suggestions,
    codeBlock,
  };
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          isUser
            ? 'bg-violet-600/30 text-violet-400'
            : 'bg-cyan-900/30 text-cyan-400'
        )}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      {/* Content */}
      <div className={clsx('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        {/* Bubble */}
        <div
          className={clsx(
            'rounded-xl px-4 py-3 text-sm leading-relaxed max-w-full',
            isUser
              ? 'text-white'
              : 'text-text-secondary'
          )}
          style={{
            background: isUser
              ? 'rgba(124,58,237,0.25)'
              : 'rgba(20,20,32,0.8)',
            border: `1px solid ${isUser ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          {/* Parse basic markdown-ish formatting */}
          {message.content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold text-text-primary">{line.replace(/\*\*/g, '')}</p>;
            }
            if (line.startsWith('- ')) {
              return (
                <div key={i} className="flex items-start gap-2 my-0.5">
                  <span style={{ color: '#7c3aed' }}>•</span>
                  <span dangerouslySetInnerHTML={{
                    __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
                  }} />
                </div>
              );
            }
            if (line.match(/^\d+\./)) {
              return (
                <div key={i} className="flex items-start gap-2 my-0.5">
                  <span className="text-violet-400 font-mono text-xs flex-shrink-0">{line.split('.')[0]}.</span>
                  <span dangerouslySetInnerHTML={{
                    __html: line.replace(/^\d+\.\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
                  }} />
                </div>
              );
            }
            return line ? (
              <p key={i} className="my-0.5" dangerouslySetInnerHTML={{
                __html: line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
              }} />
            ) : <div key={i} className="h-2" />;
          })}
        </div>

        {/* Code block */}
        {isAssistant && message.codeBlock && (
          <div className="mt-2 w-full max-w-full">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg"
              style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Code size={11} className="text-violet-400" />
              <span className="text-[10px] font-mono text-text-muted uppercase">{message.codeBlock.language}</span>
            </div>
            <div className="code-block rounded-t-none">
              {message.codeBlock.code}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {isAssistant && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.suggestions.map((sug) => (
              <button
                key={sug}
                className="text-[10px] px-2.5 py-1 rounded-full transition-all hover:bg-violet-900/30 hover:text-violet-300"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  color: '#a78bfa',
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[9px] text-text-muted mt-1.5 px-1">
          {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-cyan-900/30 text-cyan-400">
        <Bot size={13} />
      </div>
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(20,20,32,0.8)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [-2, 2, -2] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#06b6d4' }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIChatPanel() {
  const { chatMessages, addChatMessage, clearChat, activeProject, auth, updateQuota } = useAppStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiError, setApiError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep last N messages as history for the API
  const buildHistory = () =>
    chatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      setApiError('');

      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(userMsg);
      setInput('');
      setIsTyping(true);

      try {
        const context = activeProject
          ? {
              name: activeProject.name,
              genre: activeProject.genre,
              bpm: activeProject.bpm,
              mood: activeProject.mood,
              tracks: activeProject.tracks.map((t) => `${t.name} (${t.type})`),
            }
          : undefined;

        const res = await aiApi.chat(trimmed, context, buildHistory());
        const { content, quota } = res.data.data;

        const aiMsg: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        };
        addChatMessage(aiMsg);

        // Update quota display
        if (quota) updateQuota(quota);
      } catch (err: unknown) {
        const errData = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
        if (errData?.code === 'QUOTA_EXCEEDED') {
          setApiError('Daily AI quota reached. Upgrade your plan to continue.');
        } else {
          setApiError(errData?.error ?? 'Failed to reach NEUROTEK AI backend. Is it running?');
          // Fallback to local response so the UI isn't broken
          addChatMessage(generateAIResponse(trimmed));
        }
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, addChatMessage, activeProject, chatMessages, updateQuota] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}
        >
          <Bot size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">NEUROTEK AI Assistant</h2>
          <p className="text-[10px] text-text-muted">Specialised in mentalcore · hardtek · tribe · techno</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {auth.quota && (
            <span className={`text-[10px] font-mono ${auth.quota.remaining === 0 ? 'text-red-400' : auth.quota.remaining <= 5 ? 'text-amber-400' : 'text-text-muted'}`}>
              {auth.quota.remaining}/{auth.quota.limit === 9999 ? '∞' : auth.quota.limit} AI
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-mono">ONLINE</span>
          </div>
          <button
            onClick={clearChat}
            className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-area px-6 py-4 space-y-5">
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Example prompts */}
      <div
        className="flex-shrink-0 px-6 py-3 overflow-x-auto"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex gap-2">
          {EXAMPLE_PROMPTS.slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap transition-all hover:bg-violet-900/30 hover:text-violet-300"
              style={{
                background: 'rgba(124,58,237,0.07)',
                border: '1px solid rgba(124,58,237,0.18)',
                color: '#94a3b8',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 pb-4"
        style={{ paddingTop: 8 }}
      >
        <div
          className="flex items-end gap-3 rounded-xl p-3"
          style={{ background: 'rgba(15,15,26,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about production, FX chains, mix tips, templates..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted resize-none outline-none leading-relaxed"
            style={{
              maxHeight: 120,
              minHeight: 24,
              border: 'none',
              boxShadow: 'none',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !isTyping ? '#7c3aed' : 'rgba(124,58,237,0.2)',
              color: input.trim() && !isTyping ? '#fff' : '#7c3aed',
            }}
          >
            <Send size={14} />
          </motion.button>
        </div>
        {apiError && (
          <div className="flex items-center gap-2 text-[10px] text-amber-400 mt-2 px-1">
            <AlertCircle size={11} />
            <span>{apiError}</span>
          </div>
        )}
        <p className="text-[9px] text-text-muted text-center mt-2">
          Enter to send · Shift+Enter for new line · AI requests via secure backend
        </p>
      </div>
    </div>
  );
}

// ============================================================
// NEUROTEK AI — Global Keyboard Shortcuts
// ============================================================
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAudioEngine } from './useAudioEngine';

type ShortcutMap = Record<string, () => void>;

function buildKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

export function useKeyboardShortcuts() {
  const { setView, toggleSidebar } = useAppStore();
  const { play, pause, stop, playbackState } = useAudioEngine();
  const shortcutsRef = useRef<ShortcutMap>({});

  shortcutsRef.current = {
    // Transport
    'space': () => playbackState === 'playing' ? pause() : play(),
    'escape': stop,

    // Navigation
    'mod+1': () => setView('dashboard'),
    'mod+2': () => setView('templates'),
    'mod+3': () => setView('tracks'),
    'mod+4': () => setView('mix'),
    'mod+5': () => setView('mixer'),
    'mod+6': () => setView('piano-roll'),
    'mod+7': () => setView('arrangement'),
    'mod+8': () => setView('spectrum'),
    'mod+9': () => setView('chat'),
    'mod+b': toggleSidebar,
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      // Don't fire shortcuts when typing in input/textarea
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      const key = buildKey(e);
      const action = shortcutsRef.current[key];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // shortcutsRef is stable
}

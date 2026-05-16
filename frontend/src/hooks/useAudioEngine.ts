// ============================================================
// NEUROTEK AI — Audio Engine Hook
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import type { VuMeterState, SpectrumBand } from '../types';

function lerpVu(current: number, target: number, speed = 0.15): number {
  return current + (target - current) * speed;
}

function randomVu(base: number, spread = 0.3): number {
  return Math.max(0, Math.min(1, base + (Math.random() - 0.5) * spread));
}

function makeVuState(base: number): VuMeterState {
  const left = randomVu(base, 0.25);
  const right = randomVu(base, 0.25);
  const peak = Math.max(left, right) * (1 + Math.random() * 0.05);
  return { left, right, peak: Math.min(1, peak), clipping: peak > 0.97 };
}

export function useAudioEngine() {
  const { audioEngine, updateAudioEngine, activeProject } = useAppStore();
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterVuRef = useRef({ left: 0.6, right: 0.58 });
  const tickRef = useRef(0);

  const animateMeters = useCallback(() => {
    tickRef.current += 1;
    const tick = tickRef.current;

    const isLoud = Math.random() > 0.85;
    const masterBase = audioEngine.playbackState === 'playing' ? (isLoud ? 0.85 : 0.65) : 0.05;
    masterVuRef.current.left = lerpVu(masterVuRef.current.left, randomVu(masterBase, 0.2));
    masterVuRef.current.right = lerpVu(masterVuRef.current.right, randomVu(masterBase, 0.2));

    const masterVu: VuMeterState = {
      left: masterVuRef.current.left,
      right: masterVuRef.current.right,
      peak: Math.min(1, Math.max(masterVuRef.current.left, masterVuRef.current.right) + 0.03),
      clipping: masterVuRef.current.left > 0.96 || masterVuRef.current.right > 0.96,
    };

    const trackVu: Record<string, VuMeterState> = {};
    if (activeProject) {
      activeProject.tracks.forEach((track, i) => {
        const trackBase = track.muted ? 0 : (track.type === 'kick' ? 0.8 : track.type === 'bass' ? 0.7 : 0.5);
        const phase = tick * 0.05 + i * 0.7;
        const animated = trackBase * (0.8 + 0.2 * Math.sin(phase));
        trackVu[track.id] = makeVuState(audioEngine.playbackState === 'playing' ? animated : 0.02);
      });
    }

    const spectrum: SpectrumBand[] = Array.from({ length: 32 }, (_, i) => {
      const freq = 20 * Math.pow(2, (i / 31) * 10);
      const isPlaying = audioEngine.playbackState === 'playing';
      const shape = Math.exp(-((i - 6) * (i - 6)) / 60) * 0.8 + Math.random() * 0.25;
      const gain = isPlaying ? Math.max(0, Math.min(1, shape)) : Math.random() * 0.08;
      return { frequency: freq, gain };
    });

    updateAudioEngine({ masterVu, trackVu, spectrum });
    animFrameRef.current = requestAnimationFrame(animateMeters);
  }, [audioEngine.playbackState, activeProject, updateAudioEngine]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animateMeters);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animateMeters]);

  const initAudio = useCallback(async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      updateAudioEngine({
        isInitialised: true,
        latency: (audioCtxRef.current.baseLatency * 1000),
        sampleRate: audioCtxRef.current.sampleRate,
      });
    } catch (e) {
      console.warn('Web Audio API unavailable:', e);
    }
  }, [updateAudioEngine]);

  const play = useCallback(async () => {
    await initAudio();
    updateAudioEngine({ playbackState: 'playing' });
  }, [initAudio, updateAudioEngine]);

  const pause = useCallback(() => {
    updateAudioEngine({ playbackState: 'paused' });
  }, [updateAudioEngine]);

  const stop = useCallback(() => {
    updateAudioEngine({ playbackState: 'stopped', position: 0 });
  }, [updateAudioEngine]);

  const setBpm = useCallback((bpm: number) => {
    updateAudioEngine({ bpm });
  }, [updateAudioEngine]);

  const setMasterVolume = useCallback((vol: number) => {
    updateAudioEngine({ masterVolume: vol });
  }, [updateAudioEngine]);

  const tapTempo = useCallback((() => {
    const taps: number[] = [];
    return () => {
      const now = Date.now();
      taps.push(now);
      if (taps.length > 4) taps.shift();
      if (taps.length >= 2) {
        const intervals = taps.slice(1).map((t, i) => t - taps[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        if (bpm > 60 && bpm < 300) updateAudioEngine({ bpm });
      }
    };
  })(), [updateAudioEngine]);

  return {
    ...audioEngine,
    play,
    pause,
    stop,
    setBpm,
    setMasterVolume,
    tapTempo,
    initAudio,
  };
}

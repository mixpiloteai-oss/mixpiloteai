// ============================================================
// NEUROTEK AI — Clip Launcher Engine
// Ableton-style scene/clip launching, quantised to beat clock
// ============================================================
import audioEngine from './realAudioEngine';
import { computeWarpRate } from './bpmDetector';

export type ClipState = 'empty' | 'loaded' | 'playing' | 'queued' | 'stopping';
export type ClipColor = 'red' | 'orange' | 'green' | 'yellow' | 'purple' | 'cyan' | 'pink' | 'gray';

export interface Clip {
  id: string;
  trackId: string;
  sceneId: string;
  name: string;
  color: ClipColor;
  state: ClipState;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  loop: boolean;
  length: number; // bars
  bpm: number;
  volume: number;
}

export interface Scene {
  id: string;
  name: string;
  clips: Clip[];
  color: ClipColor;
}

export interface LauncherTrack {
  id: string;
  name: string;
  color: ClipColor;
  volume: number;
  muted: boolean;
}

const CLIP_COLORS: ClipColor[] = ['red', 'orange', 'green', 'yellow', 'purple', 'cyan', 'pink', 'gray'];

class ClipLauncherEngine {
  private scenes: Map<string, Scene> = new Map();
  private tracks: Map<string, LauncherTrack> = new Map();
  private clips: Map<string, Clip> = new Map();
  private queuedClips: Set<string> = new Set();
  private playingClips: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private beatUnsub: (() => void) | null = null;

  constructor() {
    this.beatUnsub = audioEngine.onBeat((beat) => {
      if (beat === 0) this.resolveQueue();
    });
  }

  // ── Scene / track setup ────────────────────────────────────
  addTrack(id: string, name: string, color: ClipColor = 'purple'): LauncherTrack {
    const track: LauncherTrack = { id, name, color, volume: 0.8, muted: false };
    this.tracks.set(id, track);
    this.emit();
    return track;
  }

  addScene(id: string, name: string, color: ClipColor = 'gray'): Scene {
    const scene: Scene = { id, name, color, clips: [] };
    this.scenes.set(id, scene);
    this.emit();
    return scene;
  }

  addClip(
    trackId: string, sceneId: string,
    opts: Partial<Pick<Clip, 'name' | 'color' | 'loop' | 'length' | 'bpm' | 'volume'>> = {},
  ): Clip {
    const id = `clip-${trackId}-${sceneId}`;
    const clip: Clip = {
      id, trackId, sceneId,
      name: opts.name ?? 'Clip',
      color: opts.color ?? CLIP_COLORS[Math.floor(Math.random() * CLIP_COLORS.length)],
      state: 'empty',
      buffer: null,
      sourceNode: null,
      loop: opts.loop ?? true,
      length: opts.length ?? 2,
      bpm: opts.bpm ?? 140,
      volume: opts.volume ?? 0.8,
    };
    this.clips.set(id, clip);
    const scene = this.scenes.get(sceneId);
    if (scene) scene.clips.push(clip);
    this.emit();
    return clip;
  }

  loadBuffer(clipId: string, buffer: AudioBuffer, sourceBpm = 140): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;
    clip.buffer = buffer;
    clip.bpm = sourceBpm;
    clip.state = 'loaded';
    this.emit();
  }

  // ── Launch / stop ──────────────────────────────────────────
  launchClip(clipId: string): void {
    const clip = this.clips.get(clipId);
    if (!clip || clip.state === 'empty') return;

    if (clip.state === 'playing') {
      // Second press: stop at next bar
      clip.state = 'stopping';
      this.emit();
      return;
    }

    // Stop any other clip on same track
    this.clips.forEach((c) => {
      if (c.trackId === clip.trackId && c.id !== clipId && c.state === 'playing') {
        c.state = 'stopping';
      }
    });

    clip.state = 'queued';
    this.queuedClips.add(clipId);
    this.emit();
  }

  launchScene(sceneId: string): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;
    scene.clips.forEach((clip) => {
      if (clip.state !== 'empty') this.launchClip(clip.id);
    });
  }

  stopAll(): void {
    this.clips.forEach((clip) => {
      if (clip.state === 'playing') clip.state = 'stopping';
    });
    this.emit();
  }

  private resolveQueue(): void {
    // Start queued clips
    this.queuedClips.forEach((id) => {
      const clip = this.clips.get(id);
      if (!clip || !clip.buffer) return;

      clip.sourceNode?.stop();
      const ctx = audioEngine.audioContext;
      const dest = audioEngine.masterInput;
      if (!ctx || !dest) return;

      const src = ctx.createBufferSource();
      src.buffer = clip.buffer;
      src.loop = clip.loop;
      src.playbackRate.value = computeWarpRate(clip.bpm, audioEngine.bpm);

      const gain = ctx.createGain();
      gain.gain.value = clip.volume;
      src.connect(gain);
      gain.connect(dest);
      src.start();

      clip.sourceNode = src;
      clip.state = 'playing';
      this.playingClips.add(id);
    });
    this.queuedClips.clear();

    // Stop clips marked 'stopping'
    this.clips.forEach((clip) => {
      if (clip.state === 'stopping') {
        clip.sourceNode?.stop();
        clip.sourceNode = null;
        clip.state = 'loaded';
        this.playingClips.delete(clip.id);
      }
    });

    this.emit();
  }

  // ── Getters ────────────────────────────────────────────────
  getScenes(): Scene[] { return [...this.scenes.values()]; }
  getTracks(): LauncherTrack[] { return [...this.tracks.values()]; }
  getClip(id: string): Clip | undefined { return this.clips.get(id); }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void { this.listeners.forEach((fn) => fn()); }

  destroy(): void {
    this.beatUnsub?.();
    this.stopAll();
  }
}

export const clipLauncher = new ClipLauncherEngine();
export default clipLauncher;

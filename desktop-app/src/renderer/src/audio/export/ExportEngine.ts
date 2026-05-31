// ─── ExportEngine ─────────────────────────────────────────────────────────────
// High-level facade composing all export pieces:
//   OfflineRenderer → MasterChain → Encoders → ExportQueue

import { exportQueue, type ExportJob, type ExportOptions } from './ExportQueue'
import type { RenderJob, RenderTrack } from './OfflineRenderer'
import type { MasterChainOptions } from './MasterChain'

export type { ExportOptions, ExportJob } from './ExportQueue'
export type { RenderTrack, RenderJob } from './OfflineRenderer'

// ─── ExportEngine ─────────────────────────────────────────────────────────────

export class ExportEngine {

  /**
   * Export the full project master mix.
   */
  async exportMaster(
    options:      ExportOptions,
    tracks:       RenderTrack[],
    sampleRate:   number,
    totalSamples: number,
    bpm:          number,
  ): Promise<ExportJob> {
    const masterOptions = this.buildMasterOptions(options, sampleRate)
    const job: RenderJob = {
      type:             'master',
      tracks,
      sampleRate,
      startSample:      0,
      endSample:        totalSamples,
      bpm,
      applyMasterChain: options.applyMasterChain,
      masterOptions,
    }
    const exportJob = exportQueue.addJob('Master Mix', job, options)
    void exportQueue.start()
    return exportJob
  }

  /**
   * Export individual stems — one job per unmuted track.
   */
  async exportStems(
    options:      ExportOptions,
    tracks:       RenderTrack[],
    sampleRate:   number,
    totalSamples: number,
    bpm:          number,
  ): Promise<ExportJob[]> {
    const masterOptions  = this.buildMasterOptions(options, sampleRate)
    const unmuted        = tracks.filter(t => !t.muted)
    const jobs: ExportJob[] = []

    for (const track of unmuted) {
      const job: RenderJob = {
        type:             'stems',
        tracks:           [track],
        sampleRate,
        startSample:      0,
        endSample:        totalSamples,
        bpm,
        applyMasterChain: false,   // stems are pre-master by convention
        masterOptions,
      }
      jobs.push(exportQueue.addJob(track.name, job, options))
    }

    void exportQueue.start()
    return jobs
  }

  /**
   * Export a selected range of the project.
   */
  async exportSelection(
    options:     ExportOptions,
    tracks:      RenderTrack[],
    startSample: number,
    endSample:   number,
    sampleRate:  number,
    bpm:         number,
  ): Promise<ExportJob> {
    const masterOptions = this.buildMasterOptions(options, sampleRate)
    const job: RenderJob = {
      type:             'selection',
      tracks,
      sampleRate,
      startSample,
      endSample,
      bpm,
      applyMasterChain: options.applyMasterChain,
      masterOptions,
    }
    const exportJob = exportQueue.addJob('Selection', job, options)
    void exportQueue.start()
    return exportJob
  }

  /**
   * Export a loop range (same as selection, semantically distinguished).
   */
  async exportLoop(
    options:     ExportOptions,
    tracks:      RenderTrack[],
    loopStart:   number,
    loopEnd:     number,
    sampleRate:  number,
    bpm:         number,
  ): Promise<ExportJob> {
    const masterOptions = this.buildMasterOptions(options, sampleRate)
    const job: RenderJob = {
      type:             'loop',
      tracks,
      sampleRate,
      startSample:      loopStart,
      endSample:        loopEnd,
      bpm,
      applyMasterChain: options.applyMasterChain,
      masterOptions,
    }
    const exportJob = exportQueue.addJob('Loop', job, options)
    void exportQueue.start()
    return exportJob
  }

  getQueue(): typeof exportQueue {
    return exportQueue
  }

  private buildMasterOptions(options: ExportOptions, sampleRate: number): MasterChainOptions {
    return {
      sampleRate,
      enableLimiter:        true,
      enableSoftClipper:    true,
      limiterThresholdDb:   -0.3,
      softClipThreshold:    0.95,
      enablePeakProtection: true,
      ...options.masterOptions,
    }
  }
}

/** Singleton export engine. */
export const exportEngine = new ExportEngine()

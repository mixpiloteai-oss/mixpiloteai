import { useCallback } from 'react'
import { useExportStore } from '../store/exportStore'
import {
  runExportPipeline,
  downloadResult,
  QUALITY_PRESETS,
  type ExportJob,
  type ExportQualityPreset,
  type QualityConfig,
} from '../audio/export/ExportPipeline'
import {
  exportStems,
  downloadStemsAsZip,
  type StemDefinition,
  type StemsOptions,
} from '../audio/export/StemsExporter'
import type { WavMetadata } from '../audio/export/encoders/WavEncoder'

function makeId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useExport() {
  const store = useExportStore()

  const runExport = useCallback(async (opts: {
    projectName: string
    durationSec: number
    preset:      ExportQualityPreset
    config?:     Partial<QualityConfig>
    metadata?:   WavMetadata
    filename?:   string
  }) => {
    store.reset()

    const baseConfig = { ...QUALITY_PRESETS[opts.preset] }
    const config = opts.config ? { ...baseConfig, ...opts.config } : baseConfig

    const job: ExportJob = {
      id:          makeId(),
      projectName: opts.projectName,
      preset:      opts.preset,
      config,
      durationSec: opts.durationSec,
      metadata:    opts.metadata,
    }

    try {
      const result = await runExportPipeline(job, (pct, phase) => {
        store.setRunning(phase, pct)
      })

      store.setDone(result)

      const ext = config.format === 'mp3' ? 'mp3' : config.format === 'flac' ? 'flac' : 'wav'
      const filename = opts.filename ?? `${opts.projectName} — ${config.label}.${ext}`
        .replace(/[/\\:*?"<>|]/g, '_')

      downloadResult(result, filename)

      store.pushHistory({
        id:         result.jobId,
        filename,
        format:     result.format,
        preset:     opts.preset,
        sizeMB:     result.sizeMB,
        lufs:       result.lufs,
        truePeakDB: result.truePeakDB,
        peakdBFS:   result.peakdBFS,
        gpuUsed:    result.gpuUsed,
        renderMs:   result.renderMs,
        timestamp:  Date.now(),
        blob:       result.blob,
      })

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      store.setError(msg)
      return null
    }
  }, [store])

  const runStemsExport = useCallback(async (opts: {
    projectName: string
    stems:       StemDefinition[]
    options:     StemsOptions
  }) => {
    store.reset()

    try {
      const results = await exportStems(
        opts.stems,
        opts.options,
        (done, total, current, pct) => {
          store.setStemsProgress(done, total, current)
          store.setRunning('rendering', Math.round((done / total) * 100 * 0.9 + pct * 0.1 / total))
        },
      )

      store.setDone({
        jobId: makeId(), format: opts.options.format,
        blob: new Blob(), durationSec: opts.options.durationSec,
        sizeMB: results.reduce((s, r) => s + r.sizeMB, 0),
        peakdBFS: -Infinity, lufs: -Infinity, truePeakDB: -Infinity,
        normResult: { mode: opts.options.normMode, measuredDB: 0, appliedGain: 0 },
        gpuUsed: false, renderMs: 0,
      })

      await downloadStemsAsZip(results, opts.projectName)

      return results
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stems export failed'
      store.setError(msg)
      return null
    }
  }, [store])

  return {
    status:       store.status,
    phase:        store.phase,
    progress:     store.progress,
    error:        store.error,
    lastResult:   store.lastResult,
    stemsDone:    store.stemsDone,
    stemsTotal:   store.stemsTotal,
    stemsCurrent: store.stemsCurrent,
    history:      store.history,
    runExport,
    runStemsExport,
    reset:        store.reset,
    removeHistory: store.removeHistory,
  }
}

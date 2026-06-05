// RecordingIPC — registers IPC handlers for the audio recording system.
// Bridges the renderer process to WavWriter/FlacEncoder via ipcMain.handle().
import type { IpcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { WavWriter } from './WavWriter'
import { FlacEncoder } from './FlacEncoder'
import { RecordingFileManager, type RecordingSessionMeta } from './RecordingFileManager'

interface StartParams {
  trackId:      string
  takeNumber:   number
  format:       'wav' | 'flac'
  sampleRate:   number
  channelCount: number
  bitDepth:     16 | 24 | 32
}

interface ChunkParams {
  sessionId: string
  // Flat interleaved PCM as a plain number array (IPC-safe; renderer converts Float32Array)
  data:      number[]
}

export function registerRecordingIPC(ipcMain: IpcMain, fileManager: RecordingFileManager): void {
  const sessions = new Map<string, WavWriter | FlacEncoder>()

  // ── recording:start ────────────────────────────────────────────────────────
  ipcMain.handle('recording:start', async (_e, params: StartParams) => {
    const { trackId, takeNumber, format, sampleRate, channelCount, bitDepth } = params

    await fileManager.ensureDir()
    const filePath  = fileManager.getRecordingPath(trackId, takeNumber, format)
    const sessionId = `${trackId}-${takeNumber}-${Date.now()}`

    let writer: WavWriter | FlacEncoder
    if (format === 'flac') {
      // FLAC encoder supports 16 or 24 bit; downgrade 32-bit input to 24-bit
      const flacDepth: 16 | 24 = bitDepth === 32 ? 24 : (bitDepth as 16 | 24)
      writer = new FlacEncoder(filePath, sampleRate, channelCount, flacDepth)
    } else {
      writer = new WavWriter(filePath, sampleRate, channelCount, bitDepth)
    }

    await writer.open()
    sessions.set(sessionId, writer)

    const meta: RecordingSessionMeta = {
      sessionId,
      trackId,
      format,
      startedAt: Date.now(),
      tmpPath:   fileManager.getTempPath(trackId),
    }
    await fileManager.writeSessionMarker(sessionId, meta)

    return { sessionId, filePath }
  })

  // ── recording:chunk ────────────────────────────────────────────────────────
  ipcMain.handle('recording:chunk', (_e, params: ChunkParams) => {
    const writer = sessions.get(params.sessionId)
    if (!writer) return
    const f32 = new Float32Array(params.data)
    writer.writeChunk(f32)
  })

  // ── recording:finalize ─────────────────────────────────────────────────────
  ipcMain.handle('recording:finalize', async (_e, sessionId: string) => {
    const writer = sessions.get(sessionId)
    if (!writer) throw new Error(`No active recording session: ${sessionId}`)
    const result = await writer.finalize()
    sessions.delete(sessionId)
    await fileManager.clearSessionMarker(sessionId)
    return result
  })

  // ── recording:abort ────────────────────────────────────────────────────────
  ipcMain.handle('recording:abort', async (_e, sessionId: string) => {
    const writer = sessions.get(sessionId)
    if (writer) {
      await writer.abort()
      sessions.delete(sessionId)
    }
    await fileManager.clearSessionMarker(sessionId).catch(() => undefined)
  })

  // ── recording:list ─────────────────────────────────────────────────────────
  ipcMain.handle('recording:list', () => fileManager.listRecordings())

  // ── recording:delete ───────────────────────────────────────────────────────
  ipcMain.handle('recording:delete', (_e, filename: string) =>
    fileManager.deleteRecording(filename),
  )

  // ── recording:read-pcm ─────────────────────────────────────────────────────
  // Reads a 16-bit PCM WAV file and returns samples as a plain number[] for IPC.
  ipcMain.handle('recording:read-pcm', async (_e, filePath: string) => {
    const buf = await fs.readFile(filePath)
    // Skip the 44-byte WAV header; each sample is a signed 16-bit LE integer
    const sampleCount = (buf.length - 44) / 2
    const samples = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = buf.readInt16LE(44 + i * 2) / 32768
    }
    return Array.from(samples)
  })
}

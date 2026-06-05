// ─── FfmpegTranscoder ──────────────────────────────────────────────────────────
// Main-process ffmpeg bridge for audio format transcoding.
// Shells out to the system ffmpeg binary (or bundled binary in resources/).

import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface FfmpegMetadata {
  title?:  string
  artist?: string
  album?:  string
  year?:   string
  genre?:  string
}

export interface TranscodeOptions {
  inputFormat:  'wav'
  outputFormat: 'mp3' | 'flac' | 'ogg' | 'aac'
  inputBytes:   Buffer
  bitrate?:     number
  quality?:     number   // for OGG: 0-10 → -q:a 0..10
  sampleRate?:  number
  metadata?:    FfmpegMetadata
}

export interface TranscodeResult {
  success:   boolean
  data?:     Buffer
  error?:    string
  codec?:    string
  duration?: number
}

const TRANSCODE_TIMEOUT_MS = 30_000

// ─── FfmpegTranscoder ─────────────────────────────────────────────────────────

export class FfmpegTranscoder {

  /**
   * Check if ffmpeg is available in PATH or as a bundled binary.
   */
  static async isAvailable(): Promise<boolean> {
    const ffmpegPath = FfmpegTranscoder.findFfmpegPath()
    if (!ffmpegPath) return false

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        proc.kill()
        resolve(false)
      }, 2000)

      const proc = execFile(ffmpegPath, ['-version'], (err) => {
        clearTimeout(timer)
        resolve(!err)
      })
    })
  }

  /**
   * Transcode audio bytes from WAV to the target format using ffmpeg.
   * Writes to temp files, runs ffmpeg, reads output, cleans up.
   */
  static async transcode(options: TranscodeOptions): Promise<TranscodeResult> {
    const ffmpegPath = FfmpegTranscoder.findFfmpegPath()
    if (!ffmpegPath) {
      return { success: false, error: 'ffmpeg not found' }
    }

    const tmpBase  = path.join(os.tmpdir(), `export_${Date.now()}`)
    const inPath   = `${tmpBase}_in.wav`
    const outExt   = options.outputFormat === 'ogg' ? 'ogg' : options.outputFormat
    const outPath  = `${tmpBase}_out.${outExt}`

    try {
      await fs.writeFile(inPath, options.inputBytes)

      const codecArgs = FfmpegTranscoder._buildCodecArgs(options)
      const metaArgs  = FfmpegTranscoder._buildMetadataArgs(options.metadata)

      const args: string[] = [
        '-i', inPath,
        ...codecArgs,
        ...metaArgs,
        '-y',
        outPath,
      ]

      await FfmpegTranscoder._runFfmpeg(ffmpegPath, args)

      const data = await fs.readFile(outPath)

      return {
        success: true,
        data,
        codec:   options.outputFormat,
      }

    } catch (err) {
      return {
        success: false,
        error:   err instanceof Error ? err.message : String(err),
      }
    } finally {
      // Clean up temp files
      await fs.unlink(inPath).catch(() => { /* ignore */ })
      await fs.unlink(outPath).catch(() => { /* ignore */ })
    }
  }

  /**
   * Find the ffmpeg binary path.
   * Checks: system PATH first, then bundled app resources.
   */
  static findFfmpegPath(): string | null {
    // In Electron, process.resourcesPath is available
    if (typeof process !== 'undefined' && process.resourcesPath) {
      const bundled = process.platform === 'win32'
        ? path.join(process.resourcesPath, 'ffmpeg.exe')
        : path.join(process.resourcesPath, 'ffmpeg')

      try {
        // Check synchronously if bundled binary exists
        const { existsSync } = require('fs') as { existsSync: (p: string) => boolean }
        if (existsSync(bundled)) return bundled
      } catch {
        // ignore
      }
    }

    // Fall back to system PATH
    return 'ffmpeg'
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private static _buildCodecArgs(options: TranscodeOptions): string[] {
    const { outputFormat, bitrate, quality } = options

    switch (outputFormat) {
      case 'mp3':
        return [
          '-codec:a', 'libmp3lame',
          '-b:a', `${bitrate ?? 192}k`,
          '-q:a', '2',
        ]
      case 'flac':
        return [
          '-codec:a', 'flac',
          '-compression_level', '5',
        ]
      case 'ogg':
        return [
          '-codec:a', 'libvorbis',
          '-q:a', String(quality ?? 5),
        ]
      case 'aac':
        return [
          '-codec:a', 'aac',
          '-b:a', `${bitrate ?? 192}k`,
        ]
      default:
        return []
    }
  }

  private static _buildMetadataArgs(metadata?: FfmpegMetadata): string[] {
    if (!metadata) return []

    const args: string[] = []
    if (metadata.title)  { args.push('-metadata', `title=${metadata.title}`) }
    if (metadata.artist) { args.push('-metadata', `artist=${metadata.artist}`) }
    if (metadata.album)  { args.push('-metadata', `album=${metadata.album}`) }
    if (metadata.year)   { args.push('-metadata', `date=${metadata.year}`) }
    if (metadata.genre)  { args.push('-metadata', `genre=${metadata.genre}`) }
    return args
  }

  private static _runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error(`ffmpeg timed out after ${TRANSCODE_TIMEOUT_MS}ms`))
      }, TRANSCODE_TIMEOUT_MS)

      const proc = execFile(ffmpegPath, args, (err, _stdout, stderr) => {
        clearTimeout(timer)
        if (err) {
          reject(new Error(`ffmpeg error: ${stderr || err.message}`))
        } else {
          resolve()
        }
      })
    })
  }
}

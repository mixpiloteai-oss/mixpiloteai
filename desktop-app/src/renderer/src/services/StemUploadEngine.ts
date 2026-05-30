// ─── StemUploadEngine ────────────────────────────────────────────────────────
// Chunked stem upload with progress, retry, and cancellation.

export const CHUNK_SIZE_BYTES = 256 * 1024 // 256 KB

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'paused'
  | 'complete'
  | 'error'
  | 'cancelled'

export interface UploadProgress {
  uploadId: string
  filename: string
  totalBytes: number
  uploadedBytes: number
  chunksDone: number
  totalChunks: number
  status: UploadStatus
  error: string | null
}

function makeUploadId(): string {
  return `upload-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
}

export class StemUploadEngine {
  private static _instance: StemUploadEngine | null = null

  static getInstance(): StemUploadEngine {
    if (!StemUploadEngine._instance) {
      StemUploadEngine._instance = new StemUploadEngine()
    }
    return StemUploadEngine._instance
  }

  private _authToken: string | null = null
  private _apiUrl: string = 'http://localhost:4000'
  private _uploads = new Map<string, UploadProgress>()
  private _abortControllers = new Map<string, AbortController>()

  setAuthToken(token: string): void {
    this._authToken = token
  }

  setApiUrl(url: string): void {
    this._apiUrl = url
  }

  async uploadStem(
    file: File,
    creatorId: string,
    onProgress?: (p: UploadProgress) => void,
  ): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
    const uploadId = makeUploadId()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES)

    const progress: UploadProgress = {
      uploadId,
      filename: file.name,
      totalBytes: file.size,
      uploadedBytes: 0,
      chunksDone: 0,
      totalChunks,
      status: 'uploading',
      error: null,
    }
    this._uploads.set(uploadId, progress)

    const controller = new AbortController()
    this._abortControllers.set(uploadId, controller)

    const updateProgress = (patch: Partial<UploadProgress>): void => {
      const current = this._uploads.get(uploadId)
      if (!current) return
      const updated = { ...current, ...patch }
      this._uploads.set(uploadId, updated)
      onProgress?.(updated)
    }

    try {
      // Step 1: Create upload session
      const sessionRes = await this._fetchJson('POST', '/api/chunks/sessions', {
        creatorId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }, controller.signal)

      if (!sessionRes.ok) {
        const err = `Failed to create upload session: ${sessionRes.status}`
        updateProgress({ status: 'error', error: err })
        return { ok: false, error: err }
      }

      const sessionBody = (await sessionRes.json()) as {
        data?: { sessionId?: string; id?: string }
        sessionId?: string
        id?: string
      }
      const sessionId =
        sessionBody.data?.sessionId ??
        sessionBody.data?.id ??
        sessionBody.sessionId ??
        sessionBody.id

      if (!sessionId) {
        const err = 'No sessionId returned from server'
        updateProgress({ status: 'error', error: err })
        return { ok: false, error: err }
      }

      // Step 2: Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        if (controller.signal.aborted) {
          updateProgress({ status: 'cancelled' })
          return { ok: false, error: 'Cancelled' }
        }

        const start = i * CHUNK_SIZE_BYTES
        const end = Math.min(start + CHUNK_SIZE_BYTES, file.size)
        const chunk = file.slice(start, end)

        const success = await this._uploadChunk(
          sessionId,
          i,
          chunk,
          controller.signal,
        )

        if (!success) {
          const err = `Failed to upload chunk ${i}`
          updateProgress({ status: 'error', error: err })
          return { ok: false, error: err }
        }

        updateProgress({
          chunksDone: i + 1,
          uploadedBytes: end,
        })
      }

      // Step 3: Finalize upload
      const finalizeRes = await this._fetchJson(
        'POST',
        `/api/chunks/${sessionId}/finalize`,
        {},
        controller.signal,
      )

      if (!finalizeRes.ok) {
        const err = `Failed to finalize upload: ${finalizeRes.status}`
        updateProgress({ status: 'error', error: err })
        return { ok: false, error: err }
      }

      updateProgress({ status: 'complete' })
      this._abortControllers.delete(uploadId)
      return { ok: true, sessionId }
    } catch (err) {
      if (controller.signal.aborted) {
        updateProgress({ status: 'cancelled' })
        return { ok: false, error: 'Cancelled' }
      }
      const errMsg = err instanceof Error ? err.message : 'Upload failed'
      updateProgress({ status: 'error', error: errMsg })
      return { ok: false, error: errMsg }
    }
  }

  private async _uploadChunk(
    sessionId: string,
    chunkIndex: number,
    data: Blob,
    signal: AbortSignal,
  ): Promise<boolean> {
    const attempt = async (): Promise<boolean> => {
      const formData = new FormData()
      formData.append('chunkIndex', String(chunkIndex))
      formData.append('data', data)

      const headers: Record<string, string> = {}
      if (this._authToken) {
        headers['authorization'] = `Bearer ${this._authToken}`
      }

      try {
        const res = await fetch(`${this._apiUrl}/api/chunks/${sessionId}`, {
          method: 'POST',
          headers,
          body: formData,
          signal,
        })
        return res.ok
      } catch {
        return false
      }
    }

    // Try once
    const first = await attempt()
    if (first) return true
    // Retry once on failure
    if (signal.aborted) return false
    return attempt()
  }

  private async _fetchJson(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (this._authToken) {
      headers['authorization'] = `Bearer ${this._authToken}`
    }
    return fetch(`${this._apiUrl}${path}`, {
      method,
      headers,
      body: JSON.stringify(body),
      signal,
    })
  }

  cancelUpload(uploadId: string): void {
    const controller = this._abortControllers.get(uploadId)
    if (controller) {
      controller.abort()
      this._abortControllers.delete(uploadId)
    }
    const progress = this._uploads.get(uploadId)
    if (progress) {
      this._uploads.set(uploadId, { ...progress, status: 'cancelled' })
    }
  }

  getProgress(uploadId: string): UploadProgress | null {
    return this._uploads.get(uploadId) ?? null
  }

  listUploads(): UploadProgress[] {
    return Array.from(this._uploads.values())
  }
}

// ── Module singleton ──────────────────────────────────────────────────────────
export function getStemUploadEngine(): StemUploadEngine {
  return StemUploadEngine.getInstance()
}

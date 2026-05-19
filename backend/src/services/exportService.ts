// ─── Export Service ───────────────────────────────────────────────────────────
// Manages server-side export job queue for batch / cloud-render jobs.
// Desktop offline export runs fully client-side; this service handles:
//   • Job registration (audit trail, usage tracking)
//   • Status polling for long-running cloud encodes
//   • Metadata storage for export history sync across devices

import { v4 as uuid } from 'uuid'

export type ExportJobStatus = 'queued' | 'processing' | 'done' | 'error'
export type ExportFormat    = 'wav' | 'mp3' | 'flac'

export interface ExportJobRecord {
  id:          string
  userId:      string
  projectId:   string
  projectName: string
  format:      ExportFormat
  preset:      string
  status:      ExportJobStatus
  createdAt:   number
  updatedAt:   number
  sizeMB?:     number
  lufs?:       number
  truePeakDB?: number
  renderMs?:   number
  gpuUsed?:    boolean
  errorMsg?:   string
}

// In-memory store (replace with DB in production)
const jobs = new Map<string, ExportJobRecord>()

export function createExportJob(
  userId: string,
  projectId: string,
  projectName: string,
  format: ExportFormat,
  preset: string,
): ExportJobRecord {
  const job: ExportJobRecord = {
    id:          uuid(),
    userId,
    projectId,
    projectName,
    format,
    preset,
    status:      'queued',
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
  }
  jobs.set(job.id, job)
  return job
}

export function updateExportJob(
  jobId: string,
  patch: Partial<Pick<ExportJobRecord, 'status' | 'sizeMB' | 'lufs' | 'truePeakDB' | 'renderMs' | 'gpuUsed' | 'errorMsg'>>,
): ExportJobRecord | null {
  const job = jobs.get(jobId)
  if (!job) return null
  Object.assign(job, patch, { updatedAt: Date.now() })
  return job
}

export function getExportJob(jobId: string): ExportJobRecord | null {
  return jobs.get(jobId) ?? null
}

export function listExportJobs(userId: string): ExportJobRecord[] {
  return [...jobs.values()]
    .filter(j => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
}

export function deleteExportJob(jobId: string, userId: string): boolean {
  const job = jobs.get(jobId)
  if (!job || job.userId !== userId) return false
  jobs.delete(jobId)
  return true
}

// Auto-evict jobs older than 7 days
setInterval(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id)
  }
}, 60 * 60 * 1000)

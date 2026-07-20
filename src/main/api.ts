import { readFile } from 'fs/promises'
import { basename } from 'path'
import type { ExtractResult } from '../shared/types'

const BASE_URL = 'https://exiftools.com/api/v1'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf'
}

function mimeFor(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

async function fileForm(filePath: string): Promise<FormData> {
  const buffer = await readFile(filePath)
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeFor(filePath) }), basename(filePath))
  return form
}

function errorMessage(status: number, apiError?: string): string {
  if (apiError) return apiError
  switch (status) {
    case 401: return 'Invalid API key — check Settings'
    case 413: return 'File exceeds the 100MB limit'
    case 415: return 'File format not supported'
    default: return `Request failed (HTTP ${status})`
  }
}

export async function extractMetadata(filePath: string, apiKey: string): Promise<ExtractResult> {
  try {
    const form = await fileForm(filePath)
    const res = await fetch(`${BASE_URL}/extract`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: form
    })
    const data = (await res.json().catch(() => ({}))) as ExtractResult
    if (!res.ok || !data.success) {
      return { success: false, error: errorMessage(res.status, data.error) }
    }
    return data
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export interface RemoveResponse {
  success: boolean
  uuid?: string
  downloadUrl?: string
  error?: string
}

export async function removeMetadata(filePath: string, apiKey: string): Promise<RemoveResponse> {
  try {
    const form = await fileForm(filePath)
    const res = await fetch(`${BASE_URL}/remove`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: form
    })
    const data = (await res.json().catch(() => ({}))) as RemoveResponse
    if (!res.ok || !data.success || !data.downloadUrl) {
      return { success: false, error: errorMessage(res.status, data.error) }
    }
    return data
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function downloadCleaned(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl)
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

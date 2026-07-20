export type MapProvider = 'mapbox' | 'google' | 'osm'

export interface Settings {
  exiftoolsKey: string
  mapboxToken: string
  googleMapsKey: string
  mapProvider: MapProvider
}

export interface ExtractResult {
  success: boolean
  status?: string
  fileName?: string
  uuid?: string
  metadata?: Record<string, Record<string, unknown>>
  error?: string
}

export interface CleanResult {
  success: boolean
  uuid?: string
  savedPath?: string
  error?: string
}

export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface QueueFile {
  id: string
  path: string
  name: string
  size: number
  status: FileStatus
  metadata?: Record<string, Record<string, unknown>>
  error?: string
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024

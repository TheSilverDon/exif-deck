import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CleanResult, ExtractResult, Settings } from '../shared/types'

export interface PickedFile {
  path: string
  name: string
  size: number
}

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Settings): Promise<Settings> => ipcRenderer.invoke('settings:set', settings),
  pickFiles: (): Promise<PickedFile[]> => ipcRenderer.invoke('files:pick'),
  extractFile: (path: string): Promise<ExtractResult> => ipcRenderer.invoke('extract:file', path),
  cleanFile: (path: string, saveDir?: string): Promise<CleanResult> =>
    ipcRenderer.invoke('clean:file', path, saveDir),
  pickCleanDir: (): Promise<string | null> => ipcRenderer.invoke('clean:pickDir'),
  exportJson: (json: string): Promise<string | null> => ipcRenderer.invoke('export:json', json),
  getThumbnail: (path: string, size: number): Promise<string | null> =>
    ipcRenderer.invoke('thumb:get', path, size),
  pathForFile: (file: File): string => webUtils.getPathForFile(file)
}

export type DeckApi = typeof api

contextBridge.exposeInMainWorld('deck', api)

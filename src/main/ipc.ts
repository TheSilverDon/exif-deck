import { ipcMain, dialog, BrowserWindow, nativeImage } from 'electron'
import { writeFile, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { extractMetadata, removeMetadata, downloadCleaned } from './api'
import { getSettings, setSettings } from './store'
import { MAX_FILE_SIZE, type CleanResult, type Settings } from '../shared/types'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:set', (_e, settings: Settings) => {
    setSettings(settings)
    return getSettings()
  })

  ipcMain.handle('files:pick', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      title: 'Add files',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    const files = await Promise.all(
      result.filePaths.map(async (p) => {
        const s = await stat(p)
        return { path: p, name: basename(p), size: s.size }
      })
    )
    return files
  })

  ipcMain.handle('extract:file', async (_e, filePath: string) => {
    const { exiftoolsKey } = getSettings()
    if (!exiftoolsKey) return { success: false, error: 'No API key set — open Settings' }
    const s = await stat(filePath).catch(() => null)
    if (!s) return { success: false, error: 'File not found' }
    if (s.size > MAX_FILE_SIZE) return { success: false, error: 'File exceeds the 100MB limit' }
    return extractMetadata(filePath, exiftoolsKey)
  })

  ipcMain.handle('clean:file', async (e, filePath: string, saveDir?: string): Promise<CleanResult> => {
    const { exiftoolsKey } = getSettings()
    if (!exiftoolsKey) return { success: false, error: 'No API key set — open Settings' }

    const removed = await removeMetadata(filePath, exiftoolsKey)
    if (!removed.success || !removed.downloadUrl) {
      return { success: false, error: removed.error ?? 'Metadata removal failed' }
    }

    const ext = extname(filePath)
    const cleanName = basename(filePath, ext) + '_cleaned' + ext

    let targetPath: string
    if (saveDir) {
      targetPath = join(saveDir, cleanName)
    } else {
      const win = BrowserWindow.fromWebContents(e.sender)
      const result = await dialog.showSaveDialog(win!, {
        title: 'Save cleaned file',
        defaultPath: cleanName
      })
      if (result.canceled || !result.filePath) return { success: false, error: 'Save cancelled' }
      targetPath = result.filePath
    }

    try {
      const buffer = await downloadCleaned(removed.downloadUrl)
      await writeFile(targetPath, buffer)
      return { success: true, uuid: removed.uuid, savedPath: targetPath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Download failed' }
    }
  })

  ipcMain.handle('clean:pickDir', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose folder for cleaned files',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('thumb:get', async (_e, filePath: string, size: number): Promise<string | null> => {
    try {
      const img = await nativeImage.createThumbnailFromPath(filePath, {
        width: Math.round(size),
        height: Math.round(size)
      })
      return img.isEmpty() ? null : img.toDataURL()
    } catch {
      // No thumbnail handler for this file type (e.g. audio, PDFs without preview)
      return null
    }
  })

  ipcMain.handle('export:json', async (e, json: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Export metadata JSON',
      defaultPath: 'exif-deck-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, json, 'utf8')
    return result.filePath
  })
}

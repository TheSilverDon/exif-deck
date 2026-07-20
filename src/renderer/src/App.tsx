import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueueFile, Settings } from '../../shared/types'
import { MAX_FILE_SIZE } from '../../shared/types'
import { FileQueue } from './components/FileQueue'
import { MetadataPanel } from './components/MetadataPanel'
import { MapPanel } from './components/MapPanel'
import { SettingsModal } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { findGps } from './lib/gps'

const CONCURRENCY = 3

interface Toast {
  text: string
  error?: boolean
}

let nextId = 1

export default function App(): JSX.Element {
  const [files, setFiles] = useState<QueueFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showThumbs, setShowThumbs] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const inFlight = useRef(new Set<string>())
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((text: string, error = false) => {
    clearTimeout(toastTimer.current)
    setToast({ text, error })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  // Load settings on boot; open settings if no API key yet
  useEffect(() => {
    window.deck.getSettings().then((s) => {
      setSettings(s)
      if (!s.exiftoolsKey) setSettingsOpen(true)
    })
  }, [])

  const addFiles = useCallback(
    (picked: { path: string; name: string; size: number }[]) => {
      if (picked.length === 0) return
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.path))
        const fresh = picked
          .filter((p) => !existing.has(p.path))
          .map((p): QueueFile => {
            const tooBig = p.size > MAX_FILE_SIZE
            return {
              id: String(nextId++),
              path: p.path,
              name: p.name,
              size: p.size,
              status: tooBig ? 'error' : 'pending',
              error: tooBig ? 'Exceeds 100MB limit' : undefined
            }
          })
        if (fresh.length > 0 && selectedId == null) setSelectedId(fresh[0].id)
        return [...prev, ...fresh]
      })
    },
    [selectedId]
  )

  // Queue pump: keep up to CONCURRENCY extractions running
  useEffect(() => {
    const pending = files.filter((f) => f.status === 'pending' && !inFlight.current.has(f.id))
    const running = files.filter((f) => f.status === 'processing').length
    const slots = CONCURRENCY - running
    if (slots <= 0 || pending.length === 0) return

    for (const file of pending.slice(0, slots)) {
      inFlight.current.add(file.id)
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'processing' } : f))
      )
      window.deck
        .extractFile(file.path)
        .then((result) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? result.success
                  ? { ...f, status: 'done', metadata: result.metadata }
                  : { ...f, status: 'error', error: result.error ?? 'Extraction failed' }
                : f
            )
          )
        })
        .finally(() => inFlight.current.delete(file.id))
    }
  }, [files])

  // Window-level drag and drop
  useEffect(() => {
    const onDragOver = (e: DragEvent): void => {
      e.preventDefault()
      if (e.dataTransfer?.types.includes('Files')) setDragOver(true)
    }
    const onDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragOver(false)
    }
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      setDragOver(false)
      const dropped = Array.from(e.dataTransfer?.files ?? [])
      addFiles(
        dropped.map((f) => ({
          path: window.deck.pathForFile(f),
          name: f.name,
          size: f.size
        }))
      )
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  const pickFiles = useCallback(async () => {
    addFiles(await window.deck.pickFiles())
  }, [addFiles])

  const selected = files.find((f) => f.id === selectedId) ?? null
  const gps = findGps(selected?.metadata)
  const doneFiles = files.filter((f) => f.status === 'done')
  const errorCount = files.filter((f) => f.status === 'error').length
  const processingCount = files.filter((f) => f.status === 'processing' || f.status === 'pending').length

  const cleanSelected = useCallback(async () => {
    if (!selected || cleaning) return
    setCleaning(true)
    const result = await window.deck.cleanFile(selected.path)
    setCleaning(false)
    if (result.success) showToast(`Cleaned file saved: ${result.savedPath}`)
    else if (result.error !== 'Save cancelled') showToast(result.error ?? 'Clean failed', true)
  }, [selected, cleaning, showToast])

  const cleanAll = useCallback(async () => {
    if (doneFiles.length === 0 || cleaning) return
    const dir = await window.deck.pickCleanDir()
    if (!dir) return
    setCleaning(true)
    let ok = 0
    let failed = 0
    for (const file of doneFiles) {
      const result = await window.deck.cleanFile(file.path, dir)
      if (result.success) ok++
      else failed++
    }
    setCleaning(false)
    showToast(
      failed === 0
        ? `${ok} cleaned file${ok === 1 ? '' : 's'} saved to ${dir}`
        : `${ok} cleaned, ${failed} failed`,
      failed > 0
    )
  }, [doneFiles, cleaning, showToast])

  const exportJson = useCallback(async () => {
    if (doneFiles.length === 0) return
    const payload = doneFiles.map((f) => ({
      file: f.name,
      path: f.path,
      metadata: f.metadata
    }))
    const saved = await window.deck.exportJson(JSON.stringify(payload, null, 2))
    if (saved) showToast(`Exported ${doneFiles.length} result${doneFiles.length === 1 ? '' : 's'} to ${saved}`)
  }, [doneFiles, showToast])

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [selectedId]
  )

  const clearAll = useCallback(() => {
    inFlight.current.clear()
    setFiles([])
    setSelectedId(null)
  }, [])

  return (
    <div className="shell">
      <header className="hud-header panel">
        <div className="hud-title">
          EXIF<span className="slash">//</span>DECK
        </div>
        <div className="hud-sub">Metadata Recon Console</div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={exportJson} disabled={doneFiles.length === 0}>
          Export JSON
        </button>
        <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>

      <main className={`deck ${gps ? 'with-map' : ''}`}>
        <section className="zone panel">
          <div className="zone-head">
            <span className="label">File Queue</span>
            <div className="zone-head-actions">
              <button
                className={`thumb-toggle ${showThumbs ? 'on' : ''}`}
                onClick={() => setShowThumbs(!showThumbs)}
                title={showThumbs ? 'Compact rows' : 'Show thumbnails'}
              >
                ▦
              </button>
              {files.length > 0 && (
                <button className="clear-all" onClick={clearAll} title="Clear all files">
                  Clear all
                </button>
              )}
              <span className="meta-count">{files.length}</span>
            </div>
          </div>
          <FileQueue
            files={files}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeFile}
            onPick={pickFiles}
            onCleanAll={cleanAll}
            cleanAllEnabled={doneFiles.length > 0 && !cleaning}
            showThumbs={showThumbs}
          />
        </section>

        <section className="zone panel">
          <MetadataPanel
            file={selected}
            onClean={cleanSelected}
            cleaning={cleaning}
          />
        </section>

        {gps && selected && settings && (
          <section className="zone panel">
            <MapPanel gps={gps} fileName={selected.name} settings={settings} />
          </section>
        )}
      </main>

      <StatusBar
        total={files.length}
        queued={processingCount}
        done={doneFiles.length}
        errors={errorCount}
        hasKey={Boolean(settings?.exiftoolsKey)}
      />

      {dragOver && <div className="dropzone-full">Release to scan</div>}

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          onSave={async (s) => {
            const saved = await window.deck.setSettings(s)
            setSettings(saved)
            setSettingsOpen(false)
            showToast('Settings saved')
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  )
}

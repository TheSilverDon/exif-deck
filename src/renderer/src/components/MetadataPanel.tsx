import { useMemo, useState } from 'react'
import type { QueueFile } from '../../../shared/types'
import { useThumbnail } from './Thumb'

interface Props {
  file: QueueFile | null
  onClean: () => void
  cleaning: boolean
}

const GROUP_ORDER = ['exif', 'gps', 'iptc', 'xmp', 'file']

function groupRank(name: string): number {
  const i = GROUP_ORDER.indexOf(name.toLowerCase())
  return i === -1 ? GROUP_ORDER.length : i
}

function display(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function Section({
  name,
  entries,
  startOpen
}: {
  name: string
  entries: [string, unknown][]
  startOpen: boolean
}): JSX.Element {
  const [open, setOpen] = useState(startOpen)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = (key: string, value: string): void => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200)
  }

  return (
    <div className="meta-section">
      <button className="meta-section-head" onClick={() => setOpen(!open)}>
        <span className={`chevron ${open ? '' : 'closed'}`}>▼</span>
        <span className="label" style={{ color: 'var(--text)' }}>
          {name}
        </span>
        <span className="meta-count">{entries.length}</span>
      </button>
      {open && (
        <div className="meta-rows">
          {entries.map(([key, value], i) => {
            const text = display(value)
            return (
              <div key={key} style={{ display: 'contents' }}>
                <div className="meta-key scan-in" style={{ animationDelay: `${Math.min(i * 12, 240)}ms` }}>
                  {key}
                </div>
                <div
                  className="meta-val scan-in"
                  style={{ animationDelay: `${Math.min(i * 12, 240)}ms` }}
                  onClick={() => copy(key, text)}
                  title="Click to copy"
                >
                  {text}
                  {copiedKey === key && <span className="copied">COPIED</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Search all metadata groups for the first matching tag (case-insensitive). */
function findTag(metadata: Record<string, Record<string, unknown>> | undefined, names: string[]): string | null {
  if (!metadata) return null
  const wanted = names.map((n) => n.toLowerCase())
  for (const group of Object.values(metadata)) {
    if (typeof group !== 'object' || group === null) continue
    for (const [key, value] of Object.entries(group)) {
      if (wanted.includes(key.toLowerCase()) && value != null) return String(value)
    }
  }
  return null
}

function PreviewStrip({ file }: { file: QueueFile }): JSX.Element | null {
  const thumb = useThumbnail(file.path, 200)
  const width = findTag(file.metadata, ['ImageWidth', 'ExifImageWidth'])
  const height = findTag(file.metadata, ['ImageHeight', 'ExifImageHeight'])
  const type = findTag(file.metadata, ['Type', 'MIMEType', 'FileType'])
  const camera = findTag(file.metadata, ['Model'])

  if (!thumb) return null

  return (
    <div className="preview-strip">
      <span className="preview-frame af-brackets active">
        <span className="af af-tl" />
        <span className="af af-tr" />
        <span className="af af-bl" />
        <span className="af af-br" />
        <img className="preview-img" src={thumb} alt="" draggable={false} />
      </span>
      <div className="preview-stats">
        {width && height && (
          <div className="pstat">
            <span className="label">Frame</span>
            <span className="pstat-val">
              {width} × {height}
            </span>
          </div>
        )}
        {type && (
          <div className="pstat">
            <span className="label">Type</span>
            <span className="pstat-val">{type}</span>
          </div>
        )}
        {camera && (
          <div className="pstat">
            <span className="label">Body</span>
            <span className="pstat-val">{camera}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function MetadataPanel({ file, onClean, cleaning }: Props): JSX.Element {
  const [filter, setFilter] = useState('')
  const [raw, setRaw] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)

  const copyRawJson = (): void => {
    if (!file?.metadata) return
    navigator.clipboard.writeText(JSON.stringify(file.metadata, null, 2))
    setJsonCopied(true)
    setTimeout(() => setJsonCopied(false), 1500)
  }

  const sections = useMemo(() => {
    if (!file?.metadata) return []
    const q = filter.trim().toLowerCase()
    return Object.entries(file.metadata)
      .sort(([a], [b]) => groupRank(a) - groupRank(b) || a.localeCompare(b))
      .map(([group, tags]) => {
        const entries = Object.entries(tags ?? {}).filter(
          ([k, v]) =>
            !q || k.toLowerCase().includes(q) || display(v).toLowerCase().includes(q)
        )
        return { group, entries }
      })
      .filter((s) => s.entries.length > 0)
  }, [file, filter])

  if (!file) {
    return (
      <div className="empty-state">
        <span style={{ fontSize: 26, color: 'var(--line-bright)' }}>[ ]</span>
        No file targeted
        <span style={{ fontSize: 10, letterSpacing: '0.1em' }}>
          drop a file to begin metadata recon
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="zone-head">
        <span className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file.name}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {raw && file.metadata && (
            <button
              className="btn btn-ghost"
              onClick={copyRawJson}
              style={jsonCopied ? { color: 'var(--green)', borderColor: 'var(--green)' } : undefined}
            >
              {jsonCopied ? 'Copied ✓' : 'Copy JSON'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setRaw(!raw)} disabled={!file.metadata}>
            {raw ? 'Grouped' : 'Raw JSON'}
          </button>
          <button className="btn btn-danger" onClick={onClean} disabled={cleaning}>
            {cleaning ? 'Cleaning…' : 'Strip metadata'}
          </button>
        </div>
      </div>

      {file.status === 'processing' || file.status === 'pending' ? (
        <div className="empty-state">
          <span className="dot dot-processing" style={{ width: 10, height: 10 }} />
          Scanning…
        </div>
      ) : file.status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--red)' }}>
          Scan failed
          <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'none', fontFamily: 'var(--mono)', letterSpacing: 0 }}>
            {file.error}
          </span>
        </div>
      ) : raw ? (
        <div className="zone-body">
          <pre className="raw-json">{JSON.stringify(file.metadata, null, 2)}</pre>
        </div>
      ) : (
        <>
          <PreviewStrip file={file} />
          <div className="meta-toolbar">
            <input
              className="input"
              placeholder="Filter tags…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              spellCheck={false}
            />
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              {sections.reduce((n, s) => n + s.entries.length, 0)} tags
            </span>
          </div>
          <div className="zone-body">
            {sections.length === 0 ? (
              <div className="empty-state">No tags match</div>
            ) : (
              sections.map((s, i) => (
                <Section
                  key={`${file.id}-${s.group}-${filter}`}
                  name={s.group}
                  entries={s.entries}
                  startOpen={i < 4}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  )
}

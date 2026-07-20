import type { QueueFile } from '../../../shared/types'
import { findGps } from '../lib/gps'
import { Thumb } from './Thumb'

interface Props {
  files: QueueFile[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onPick: () => void
  onCleanAll: () => void
  cleanAllEnabled: boolean
  showThumbs: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileQueue({
  files,
  selectedId,
  onSelect,
  onRemove,
  onPick,
  onCleanAll,
  cleanAllEnabled,
  showThumbs
}: Props): JSX.Element {
  return (
    <>
      <div className="zone-body">
        {files.length === 0 ? (
          <button className="dropzone" onClick={onPick}>
            <div className="reticle" />
            <span className="display" style={{ fontSize: 12, letterSpacing: '0.2em' }}>
              Drop files anywhere
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>or click to browse</span>
          </button>
        ) : (
          <div className="queue-list">
            {files.map((f) => (
              <button
                key={f.id}
                className={`queue-item scan-in ${f.id === selectedId ? 'selected' : ''} ${showThumbs ? 'thumbs' : ''}`}
                onClick={() => onSelect(f.id)}
                title={f.error ? `${f.path}\n${f.error}` : f.path}
              >
                <span className={`dot dot-${f.status}`} />
                {showThumbs && (
                  <span className="queue-thumb">
                    <Thumb path={f.path} size={40} className="queue-thumb-img" />
                  </span>
                )}
                <span className="fname">{f.name}</span>
                {findGps(f.metadata) && (
                  <span className="gps-flag" title="GPS coordinates found">
                    GPS
                  </span>
                )}
                {f.status === 'error' ? (
                  <span className="ferr">{f.error}</span>
                ) : (
                  <span className="fsize">{formatSize(f.size)}</span>
                )}
                <span
                  role="button"
                  aria-label={`Remove ${f.name}`}
                  style={{ color: 'var(--text-faint)', padding: '0 2px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(f.id)
                  }}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="queue-actions">
        <button className="btn" onClick={onPick}>
          + Add files
        </button>
        <button className="btn btn-ghost" onClick={onCleanAll} disabled={!cleanAllEnabled}>
          Clean all → folder
        </button>
      </div>
    </>
  )
}

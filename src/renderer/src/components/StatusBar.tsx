interface Props {
  total: number
  queued: number
  done: number
  errors: number
  hasKey: boolean
}

export function StatusBar({ total, queued, done, errors, hasKey }: Props): JSX.Element {
  return (
    <footer className="status-bar">
      <span className="stat">
        LINK{' '}
        <b style={{ color: hasKey ? 'var(--green)' : 'var(--amber)' }}>
          {hasKey ? 'ARMED' : 'NO KEY'}
        </b>
      </span>
      <span className="stat">
        FILES <b>{total}</b>
      </span>
      <span className="stat">
        QUEUE <b>{queued}</b>
      </span>
      <span className="stat">
        SCANNED <b>{done}</b>
      </span>
      {errors > 0 && (
        <span className="stat err">
          ERR <b style={{ color: 'var(--red)' }}>{errors}</b>
        </span>
      )}
      <span className="flex-spacer" />
      <span className="attribution">processed via exiftools.com</span>
    </footer>
  )
}

import { useEffect, useState } from 'react'

/* Thumbnails come from the OS thumbnail engine via the main process and are
   cached per path+size for the session. Renders nothing until (and unless)
   a thumbnail is actually available, so unsupported types cost no space. */

const cache = new Map<string, Promise<string | null>>()

function fetchThumb(path: string, size: number): Promise<string | null> {
  const key = `${path}@${size}`
  let p = cache.get(key)
  if (!p) {
    p = window.deck.getThumbnail(path, size).catch(() => null)
    cache.set(key, p)
  }
  return p
}

export function useThumbnail(path: string, size: number): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setUrl(null)
    fetchThumb(path, size).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [path, size])

  return url
}

interface Props {
  path: string
  size: number
  className?: string
}

export function Thumb({ path, size, className }: Props): JSX.Element | null {
  const url = useThumbnail(path, size)
  if (!url) return null
  return <img className={className} src={url} alt="" draggable={false} />
}

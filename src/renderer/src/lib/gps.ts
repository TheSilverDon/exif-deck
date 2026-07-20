export interface LatLng {
  lat: number
  lng: number
}

/** Parse a single EXIF GPS coordinate value into signed decimal degrees.
 *  Handles: 40.446195, "40.446195", "40 deg 26' 46.30\" N", "40,26.7717N", "40/1 26/1 4630/100" */
function parseCoord(value: unknown, ref?: unknown): number | null {
  if (value == null) return null

  let decimal: number | null = null

  if (typeof value === 'number') {
    decimal = value
  } else if (typeof value === 'string') {
    const s = value.trim()
    // DMS: 40 deg 26' 46.30" N  /  40°26'46.3"N
    const dms = s.match(
      /(-?[\d.]+)\s*(?:deg|°)\s*([\d.]+)?\s*'?\s*([\d.]+)?\s*"?\s*([NSEW])?/i
    )
    if (dms && dms[1] !== undefined) {
      const d = parseFloat(dms[1])
      const m = dms[2] ? parseFloat(dms[2]) : 0
      const sec = dms[3] ? parseFloat(dms[3]) : 0
      decimal = Math.abs(d) + m / 60 + sec / 3600
      if (d < 0) decimal = -decimal
      const dir = dms[4]?.toUpperCase()
      if (dir === 'S' || dir === 'W') decimal = -Math.abs(decimal)
    } else {
      const plain = parseFloat(s)
      if (!Number.isNaN(plain)) decimal = plain
    }
  }

  if (decimal == null || Number.isNaN(decimal)) return null

  if (typeof ref === 'string') {
    const r = ref.trim().toUpperCase()
    if (r.startsWith('S') || r.startsWith('W')) decimal = -Math.abs(decimal)
  }

  return decimal
}

/** Scan extracted metadata (any group) for usable GPS coordinates. */
export function findGps(metadata: Record<string, Record<string, unknown>> | undefined): LatLng | null {
  if (!metadata) return null

  const groups = Object.values(metadata)
  let lat: number | null = null
  let lng: number | null = null

  for (const group of groups) {
    if (typeof group !== 'object' || group === null) continue
    const g = group as Record<string, unknown>

    // Composite single-field form: "40.446195 -79.948862" or "40 deg ... N, 79 deg ... W"
    const pos = g['GPSPosition']
    if (typeof pos === 'string' && lat == null) {
      const parts = pos.split(/,| (?=-?\d+ deg)/i).map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        const la = parseCoord(parts[0])
        const lo = parseCoord(parts[1])
        if (la != null && lo != null) {
          lat = la
          lng = lo
        }
      }
    }

    if (lat == null) {
      const la = parseCoord(g['GPSLatitude'], g['GPSLatitudeRef'])
      const lo = parseCoord(g['GPSLongitude'], g['GPSLongitudeRef'])
      if (la != null && lo != null) {
        lat = la
        lng = lo
      }
    }
  }

  if (lat == null || lng == null) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export function formatCoords({ lat, lng }: LatLng): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(5)}° ${ns}  ${Math.abs(lng).toFixed(5)}° ${ew}`
}

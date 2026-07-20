import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Settings } from '../../../shared/types'
import { formatCoords, type LatLng } from '../lib/gps'

/* HUD map palette — shared across providers */
const ROAD_MINOR = '#8a8530' // dull neon yellow, quiet
const ROAD_MAJOR = '#c9c33c' // dull neon yellow, bright
const TEXT_COLOR = '#ff7e33' // neon burnt orange
const TEXT_HALO = '#05080d'
const WATER = '#071620'

interface Props {
  gps: LatLng
  fileName: string
  settings: Settings
}

function makeMarkerEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'gps-marker'
  return el
}

/* ---------------- Mapbox ---------------- */

function MapboxMap({ gps, token }: { gps: LatLng; token: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = token

    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [gps.lng, gps.lat],
        zoom: 13,
        attributionControl: false
      })
    } catch {
      setFailed(true)
      return
    }

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('error', (e) => {
      if (!map.isStyleLoaded()) setFailed(true)
      console.warn('mapbox error', e.error?.message)
    })

    // Re-tint the dark style: yellow road network, burnt-orange labels
    map.on('style.load', () => {
      setFailed(false)
      try {
        map.setPaintProperty('water', 'fill-color', WATER)
        map.setFog({ color: '#05080d', 'horizon-blend': 0.1 })
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === 'line' && /road|street|bridge|tunnel/.test(layer.id)) {
            const major = /motorway|trunk|primary|secondary|major/.test(layer.id)
            map.setPaintProperty(layer.id, 'line-color', major ? ROAD_MAJOR : ROAD_MINOR)
          }
          if (layer.type === 'symbol') {
            try {
              map.setPaintProperty(layer.id, 'text-color', TEXT_COLOR)
              map.setPaintProperty(layer.id, 'text-halo-color', TEXT_HALO)
            } catch {
              /* some symbol layers have no text */
            }
          }
        }
      } catch {
        /* best effort re-tint; base dark style is acceptable */
      }
    })

    markerRef.current = new mapboxgl.Marker({ element: makeMarkerEl() })
      .setLngLat([gps.lng, gps.lat])
      .addTo(map)

    mapRef.current = map
    return () => {
      markerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.setLngLat([gps.lng, gps.lat])
    map.flyTo({ center: [gps.lng, gps.lat], zoom: 13, duration: 1200 })
  }, [gps.lat, gps.lng])

  if (failed) return <div className="map-offline">Map unavailable — check Mapbox token</div>
  return <div ref={containerRef} className="map-canvas" />
}

/* ---------------- OpenStreetMap (Leaflet) ---------------- */

function OsmMap({ gps }: { gps: LatLng }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [gps.lat, gps.lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      className: 'osm-dark-tiles',
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    markerRef.current = L.marker([gps.lat, gps.lng], {
      icon: L.divIcon({ className: '', html: '<div class="gps-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
    }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.setLatLng([gps.lat, gps.lng])
    map.flyTo([gps.lat, gps.lng], 13, { duration: 1.2 })
  }, [gps.lat, gps.lng])

  return <div ref={containerRef} className="map-canvas" />
}

/* ---------------- Google Maps ---------------- */

/* Minimal ambient typing for the dynamically loaded Google Maps API */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleApi = any

let googleLoader: Promise<GoogleApi> | null = null

function loadGoogleMaps(key: string): Promise<GoogleApi> {
  const w = window as unknown as Record<string, GoogleApi>
  if (w['google']?.maps) return Promise.resolve(w['google'])
  if (!googleLoader) {
    googleLoader = new Promise((resolve, reject) => {
      w['__gmapsReady'] = () => resolve(w['google'])
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__gmapsReady`
      script.onerror = () => {
        googleLoader = null
        reject(new Error('Google Maps failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return googleLoader
}

const GOOGLE_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a1018' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: TEXT_COLOR }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: TEXT_HALO }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: WATER }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: ROAD_MINOR }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: ROAD_MAJOR }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#05080d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0e1620' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#12202e' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#080d14' }] }
]

const GOOGLE_MARKER_SVG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="4" fill="#00e5ff"/><circle cx="11" cy="11" r="9" fill="none" stroke="#00e5ff" stroke-opacity="0.5"/></svg>'
  )

function GoogleMap({ gps, apiKey }: { gps: LatLng; apiKey: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleApi>(null)
  const markerRef = useRef<GoogleApi>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !containerRef.current) return
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: gps.lat, lng: gps.lng },
          zoom: 13,
          styles: GOOGLE_DARK_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: '#05080d'
        })
        markerRef.current = new google.maps.Marker({
          position: { lat: gps.lat, lng: gps.lng },
          map,
          icon: GOOGLE_MARKER_SVG
        })
        mapRef.current = map
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.setPosition({ lat: gps.lat, lng: gps.lng })
    map.panTo({ lat: gps.lat, lng: gps.lng })
  }, [gps.lat, gps.lng])

  if (failed) return <div className="map-offline">Map unavailable — check Google Maps key</div>
  return <div ref={containerRef} className="map-canvas" />
}

/* ---------------- Panel shell ---------------- */

export function MapPanel({ gps, fileName, settings }: Props): JSX.Element {
  const provider = settings.mapProvider

  let content: JSX.Element
  if (provider === 'mapbox') {
    content = settings.mapboxToken ? (
      <MapboxMap gps={gps} token={settings.mapboxToken} />
    ) : (
      <div className="map-offline">No Mapbox token — open Settings</div>
    )
  } else if (provider === 'google') {
    content = settings.googleMapsKey ? (
      <GoogleMap gps={gps} apiKey={settings.googleMapsKey} />
    ) : (
      <div className="map-offline">No Google Maps key — open Settings</div>
    )
  } else {
    content = <OsmMap gps={gps} />
  }

  const providerLabel = provider === 'mapbox' ? 'Mapbox' : provider === 'google' ? 'Google' : 'OSM'

  return (
    <>
      <div className="zone-head">
        <span className="label">
          GPS Fix <span style={{ color: 'var(--text-faint)' }}>· {providerLabel}</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fileName}
        </span>
      </div>
      <div className="map-wrap">
        {content}
        <div className="map-coords">{formatCoords(gps)}</div>
      </div>
    </>
  )
}

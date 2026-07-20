import { useState } from 'react'
import type { MapProvider, Settings } from '../../../shared/types'

interface Props {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

const PROVIDERS: { value: MapProvider; label: string; hint: string }[] = [
  {
    value: 'mapbox',
    label: 'Mapbox',
    hint: 'A public token (pk.…) from account.mapbox.com.'
  },
  {
    value: 'google',
    label: 'Google Maps',
    hint: 'An API key with the Maps JavaScript API enabled, from console.cloud.google.com.'
  },
  {
    value: 'osm',
    label: 'OpenStreetMap',
    hint: 'Free — no key required. Tiles from openstreetmap.org.'
  }
]

export function SettingsModal({ settings, onSave, onClose }: Props): JSX.Element {
  const [exiftoolsKey, setExiftoolsKey] = useState(settings.exiftoolsKey)
  const [mapboxToken, setMapboxToken] = useState(settings.mapboxToken)
  const [googleMapsKey, setGoogleMapsKey] = useState(settings.googleMapsKey)
  const [mapProvider, setMapProvider] = useState<MapProvider>(settings.mapProvider)

  const providerInfo = PROVIDERS.find((p) => p.value === mapProvider)!

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && settings.exiftoolsKey) onClose()
      }}
    >
      <div className="modal panel af-brackets active">
        <span className="af af-tl" />
        <span className="af af-tr" />
        <span className="af af-bl" />
        <span className="af af-br" />

        <div className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          System <span style={{ color: 'var(--cyan)' }}>Config</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="exif-key">
            exiftools.com API key
          </label>
          <input
            id="exif-key"
            className="input"
            type="password"
            value={exiftoolsKey}
            onChange={(e) => setExiftoolsKey(e.target.value)}
            placeholder="Required for extraction and cleaning"
            autoFocus
          />
          <span className="hint">
            Get a key at exiftools.com/api-keys. Files are uploaded to exiftools.com for
            processing (100MB max). Keys are stored encrypted on this machine.
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor="map-provider">
            Map provider
          </label>
          <select
            id="map-provider"
            className="input select"
            value={mapProvider}
            onChange={(e) => setMapProvider(e.target.value as MapProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="hint">{providerInfo.hint}</span>
        </div>

        {mapProvider === 'mapbox' && (
          <div className="field">
            <label className="label" htmlFor="mapbox-token">
              Mapbox access token
            </label>
            <input
              id="mapbox-token"
              className="input"
              type="password"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.…"
            />
          </div>
        )}

        {mapProvider === 'google' && (
          <div className="field">
            <label className="label" htmlFor="google-key">
              Google Maps API key
            </label>
            <input
              id="google-key"
              className="input"
              type="password"
              value={googleMapsKey}
              onChange={(e) => setGoogleMapsKey(e.target.value)}
              placeholder="AIza…"
            />
          </div>
        )}

        <div className="actions">
          {settings.exiftoolsKey && (
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            className="btn"
            onClick={() => onSave({ exiftoolsKey, mapboxToken, googleMapsKey, mapProvider })}
            disabled={!exiftoolsKey.trim()}
          >
            Save config
          </button>
        </div>
      </div>
    </div>
  )
}

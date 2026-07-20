import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { MapProvider, Settings } from '../shared/types'

const store = new Store<{
  exiftoolsKey?: string
  mapboxToken?: string
  googleMapsKey?: string
  mapProvider?: MapProvider
}>({
  name: 'exif-deck-settings'
})

function encrypt(value: string): string {
  if (!value) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return 'plain:' + Buffer.from(value, 'utf8').toString('base64')
}

function decrypt(value: string | undefined): string {
  if (!value) return ''
  try {
    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(6), 'base64').toString('utf8')
    }
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return ''
  }
}

const PROVIDERS: MapProvider[] = ['mapbox', 'google', 'osm']

export function getSettings(): Settings {
  const provider = store.get('mapProvider')
  return {
    exiftoolsKey: decrypt(store.get('exiftoolsKey')),
    mapboxToken: decrypt(store.get('mapboxToken')),
    googleMapsKey: decrypt(store.get('googleMapsKey')),
    mapProvider: provider && PROVIDERS.includes(provider) ? provider : 'mapbox'
  }
}

export function setSettings(settings: Settings): void {
  store.set('exiftoolsKey', encrypt(settings.exiftoolsKey.trim()))
  store.set('mapboxToken', encrypt(settings.mapboxToken.trim()))
  store.set('googleMapsKey', encrypt(settings.googleMapsKey.trim()))
  store.set('mapProvider', PROVIDERS.includes(settings.mapProvider) ? settings.mapProvider : 'mapbox')
}

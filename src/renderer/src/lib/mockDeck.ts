/* Browser-preview fallback: when the renderer is opened outside Electron
   (no preload bridge), install a mock window.deck with sample data so the
   UI can be developed and reviewed in a normal browser tab. */

const SAMPLE_METADATA = {
  exif: {
    Make: 'Canon',
    Model: 'EOS R5',
    LensModel: 'RF 24-70mm F2.8 L IS USM',
    DateTimeOriginal: '2024:03:15 10:30:00',
    ExposureTime: '1/1000',
    FNumber: 2.8,
    ISO: 100,
    FocalLength: '50.0 mm',
    WhiteBalance: 'Auto',
    Flash: 'Off, Did not fire'
  },
  gps: {
    GPSLatitude: "40 deg 26' 46.30\" N",
    GPSLatitudeRef: 'North',
    GPSLongitude: "79 deg 56' 55.90\" W",
    GPSLongitudeRef: 'West',
    GPSAltitude: '270 m Above Sea Level'
  },
  iptc: {
    Creator: 'John Doe',
    Copyright: '© 2024',
    Keywords: 'skyline, dusk'
  },
  file: {
    Name: 'sample_shot.jpg',
    Size: 8452130,
    Type: 'image/jpeg',
    ImageWidth: 8192,
    ImageHeight: 5464
  }
}

export function installMockDeck(): void {
  if (typeof window.deck !== 'undefined') return

  let picked = 0
  window.deck = {
    getSettings: async () => ({
      exiftoolsKey: 'mock-key',
      mapboxToken: '',
      googleMapsKey: '',
      mapProvider: 'osm'
    }),
    setSettings: async (s) => s,
    pickFiles: async () => {
      picked++
      return [
        {
          path: `C:/mock/sample_shot_${picked}.jpg`,
          name: `sample_shot_${picked}.jpg`,
          size: 8452130
        }
      ]
    },
    extractFile: async () => {
      await new Promise((r) => setTimeout(r, 900))
      return {
        success: true,
        status: 'completed',
        uuid: 'mock-uuid',
        metadata: SAMPLE_METADATA
      }
    },
    cleanFile: async () => ({ success: true, uuid: 'mock-uuid', savedPath: 'C:/mock/sample_cleaned.jpg' }),
    pickCleanDir: async () => 'C:/mock',
    exportJson: async () => 'C:/mock/exif-deck-export.json',
    getThumbnail: async (_path: string, size: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = Math.round(size * 0.66)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#123240')
      grad.addColorStop(0.6, '#0a5c6e')
      grad.addColorStop(1, '#ff7e33')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = 'rgba(0,229,255,0.6)'
      ctx.beginPath()
      ctx.moveTo(canvas.width / 2, 6)
      ctx.lineTo(canvas.width / 2, canvas.height - 6)
      ctx.moveTo(6, canvas.height / 2)
      ctx.lineTo(canvas.width - 6, canvas.height / 2)
      ctx.stroke()
      return canvas.toDataURL()
    },
    pathForFile: (file: File) => `C:/mock/${file.name}`
  }
}

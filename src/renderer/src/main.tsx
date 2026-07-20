import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import './theme/hud.css'
import './theme/app.css'
import { installMockDeck } from './lib/mockDeck'
import App from './App'

installMockDeck()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

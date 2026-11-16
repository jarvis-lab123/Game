import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './ui/App'

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})

// Web/PWA: install updates automatically (reloads once the new version is ready) and check every 30 min
if (import.meta.env.MODE !== 'tauri') {
  void import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (reg) setInterval(() => void reg.update(), 30 * 60 * 1000)
      },
    }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

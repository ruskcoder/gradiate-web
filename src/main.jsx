import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    <App />
  // </StrictMode>,
)

// Installable / offline shell. Skipped in dev so Vite's HMR isn't cached.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW registration failed:', e))
  })
}

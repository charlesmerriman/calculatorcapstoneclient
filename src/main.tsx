import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (bundled) variable font — used only by the <Wordmark> brand text.
// Shipping the woff2 ourselves avoids a third-party request on every page load
// and keeps the app working under a strict CSP. Imported before index.css so the
// @font-face rules are registered before the @theme token that references them.
import '@fontsource-variable/outfit'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

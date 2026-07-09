import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.css'
import './index.css'
import App from './App.tsx'
import QuickCaptureWindow from './QuickCaptureWindow.tsx'

// The floating global-shortcut popup (feature 9) loads this same bundle in a second,
// tiny Tauri window via index.html?quickcapture=1 — deliberately not the full <App/>,
// since that would pull in the entire vault scan, sidebar, and app hook for what's meant
// to be an instant, disposable capture box.
const isQuickCapture = new URLSearchParams(location.search).get('quickcapture') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isQuickCapture ? <QuickCaptureWindow /> : <App />}
  </StrictMode>,
)

import '@fontsource-variable/nunito'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { store } from './lib/store'
import { setupPWA } from './pwa'

void store.init()
setupPWA()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

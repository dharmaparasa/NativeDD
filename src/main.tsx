import '@fontsource-variable/nunito'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { store } from './lib/store'
import { setupPWA } from './pwa'
import { refreshNativeNotificationsOnResume } from './lib/nativeNotifications'

void store.init()
setupPWA()
void refreshNativeNotificationsOnResume(() => store.getState()).catch((error: unknown) => {
  console.error('Could not register native notification resume listener', error)
})
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

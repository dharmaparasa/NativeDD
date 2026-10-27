import { store } from './lib/store'
import { Capacitor } from '@capacitor/core'

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
export const canInstall = () => deferred !== null
export const onInstallChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export async function promptInstall() { if (!deferred) return; await deferred.prompt(); deferred = null; listeners.forEach((l) => l()) }

export function setupPWA() {
  if (Capacitor.isNativePlatform()) return
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()) })
  if (import.meta.env.PROD) {
    void import('virtual:pwa-register')
      .then(({ registerSW }) => registerSW({ immediate: true, onOfflineReady: () => store.showToast('Ready to work offline') }))
      .catch((error: unknown) => console.error('Could not register the PWA service worker', error))
    void navigator.storage?.persist?.() // ask the browser not to evict our data
  }
}

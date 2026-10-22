import { registerSW } from 'virtual:pwa-register'
import { store } from './lib/store'

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
export const canInstall = () => deferred !== null
export const onInstallChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export async function promptInstall() { if (!deferred) return; await deferred.prompt(); deferred = null; listeners.forEach((l) => l()) }

export function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()) })
  if (import.meta.env.PROD) {
    registerSW({ immediate: true, onOfflineReady: () => store.showToast('Ready to work offline') })
    void navigator.storage?.persist?.() // ask the browser not to evict our data
  }
}

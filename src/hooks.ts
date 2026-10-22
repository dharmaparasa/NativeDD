import { useEffect, useState, useSyncExternalStore } from 'react'
import { store } from './lib/store'
import { occurrencesOn } from './lib/recurrence'
import { buildEvents, coalesce, selectDue } from './lib/notify'
import { playSound, unlockAudio } from './lib/sound'
import { todayStr } from './lib/time'
import { canInstall, onInstallChange } from './pwa'

export function useNow(ms = 10_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [ms])
  return now
}
export const useCanInstall = () => useSyncExternalStore(onInstallChange, canInstall)
export const isTyping = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Hourly / start / end sounds while the app is open. Safe after sleep: only events from the last 90 s play. */
export function useNotifier() {
  useEffect(() => {
    const unlock = () => { void unlockAudio() }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    let busy = false
    const tick = async () => {
      const st = store.getState()
      if (!st.ready || busy) return
      busy = true
      try {
        const now = Date.now(), date = todayStr(new Date(now))
        const events = buildEvents(date, occurrencesOn(Object.values(st.data.activities), date))
        const { play, mark } = selectDue(events, now, store.fired)
        if (!mark.length) return
        store.markFired(mark) // recorded first, so a refresh can never replay it
        const { settings } = st
        for (const e of coalesce(play)) {
          const pref = settings[e.kind]
          if (pref.on) { await playSound(e.kind, pref.volume); await new Promise((r) => setTimeout(r, 700)) }
          if (settings.systemNotifications && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
            const opts = { body: e.body, tag: e.key, silent: true, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` }
            try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.showNotification(e.title, opts); else new Notification(e.title, opts) } catch { /* unsupported */ }
          }
        }
      } finally { busy = false }
    }
    void tick()
    const id = setInterval(tick, 5000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [])
}

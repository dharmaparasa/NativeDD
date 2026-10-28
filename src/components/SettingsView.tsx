import { useRef, useState, type ReactNode } from 'react'
import { Download, Play, Smartphone, Trash2, Upload } from 'lucide-react'
import { useStore, store } from '../lib/store'
import { Segmented, Sheet, Toggle } from './ui'
import { playSound, unlockAudio } from '../lib/sound'
import type { EventKind } from '../lib/notify'
import { makeBackup, parseBackup, type Backup } from '../lib/backup'
import { useCanInstall } from '../hooks'
import { promptInstall } from '../pwa'
import { isAndroidNative, previewNativeSound, requestNativeNotificationPermissions, scheduleNativeTestAlarm } from '../lib/nativeNotifications'

const SOUNDS: { kind: EventKind; label: string; hint: string }[] = [
  { kind: 'hourly', label: 'Hourly chime', hint: 'A soft bell at the start of each hour' },
  { kind: 'start', label: 'Activity starts', hint: 'A bright rising trio' },
  { kind: 'end', label: 'Activity ends', hint: 'A mellow falling pair' },
]
const Section = ({ title, children }: { title: string; children: ReactNode }) => <section className="panel space-y-3"><h2 className="font-black">{title}</h2>{children}</section>

export default function SettingsView() {
  const st = useStore()
  const s = st.settings
  const canInstall = useCanInstall()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [error, setError] = useState('')
  const [clearing, setClearing] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')
  const nativeAndroid = isAndroidNative()

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(makeBackup(st.data, s), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `daybloom-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const onFile = async (f?: File) => {
    if (!f) return
    const r = parseBackup(await f.text()); if (file.current) file.current.value = ''
    if (r.ok) { setError(''); setPending(r.backup) } else setError(r.error)
  }
  const enableSystem = async (on: boolean) => {
    if (!on) { store.updateSettings({ systemNotifications: false }); setNotifMsg(''); return }
    if (nativeAndroid) {
      try {
        const status = await requestNativeNotificationPermissions()
        if (status.display === 'granted' && status.exactAlarm === 'granted') {
          store.updateSettings({ systemNotifications: true })
          setNotifMsg('')
        } else if (status.display === 'granted') {
          setNotifMsg('Exact reminders are not enabled. Allow “Alarms & reminders” for Daybloom in Android settings, then turn notifications on again.')
        } else {
          setNotifMsg('Notification permission was not granted. Allow Daybloom notifications in Android settings.')
        }
      } catch (e) {
        console.error('Could not request native notification permissions', e)
        setNotifMsg('Could not enable notifications. Check notification and Alarms & reminders permissions in Android settings.')
      }
      return
    }
    if (!('Notification' in window)) { setNotifMsg('This browser does not support system notifications.'); return }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (p === 'granted') { store.updateSettings({ systemNotifications: true }); setNotifMsg('') }
    else setNotifMsg('Permission was not granted. You can allow notifications in your browser’s site settings.')
  }
  const count = (b: { activities: object; tasks: object; completed: object }) => `${Object.keys(b.activities).length} activities, ${Object.keys(b.tasks).length} tasks, ${Object.keys(b.completed).length} completed`

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto px-4 pb-32 pt-[calc(1rem+var(--safe-t))] hide-scroll">
      <h1 className="mb-3 px-1 text-2xl font-black">Settings</h1>
      <div className="space-y-3">
        <Section title="Sounds">
          {SOUNDS.map(({ kind, label, hint }) => {
            const p = s[kind]
            return (
              <div key={kind} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1"><div className="font-bold">{label}</div><div className="text-xs font-semibold text-ink-faint">{hint}</div></div>
                  <button className="icon-btn border border-line" aria-label={`Preview ${label}`} onClick={async () => {
                    if (nativeAndroid) {
                      try { await previewNativeSound(kind); store.showToast('Sound preview scheduled. Lock the screen to test it.') }
                      catch (e) { console.error('Could not schedule native sound preview', e); store.showToast('Allow notifications before previewing native sounds.') }
                    } else {
                      const ok = await playSound(kind, p.volume)
                      if (!ok) store.showToast('Your browser blocked audio. Tap again.')
                    }
                  }}><Play size={16} /></button>
                  <Toggle on={p.on} label={label} onChange={(on) => store.updateSettings({ [kind]: { ...p, on } })} />
                </div>
                <input type="range" min={0} max={1} step={0.05} value={p.volume} disabled={!p.on} aria-label={`${label} volume`} className="w-full accent-[#4AA8E8]"
                  onChange={(e) => store.updateSettings({ [kind]: { ...p, volume: Number(e.target.value) } })} onPointerDown={() => void unlockAudio()} />
              </div>
            )
          })}
          <div className="flex items-center gap-3 border-t border-line pt-3">
            <div className="min-w-0 flex-1"><div className="font-bold">{nativeAndroid ? 'Scheduled notifications' : 'System notifications'}</div><div className="text-xs font-semibold text-ink-faint">{nativeAndroid ? 'Android alarms for hourly, start and end reminders' : 'Banners while the app is in the background'}</div></div>
            <Toggle on={s.systemNotifications} label={nativeAndroid ? 'Scheduled notifications' : 'System notifications'} onChange={enableSystem} />
          </div>
          {nativeAndroid && (
            <button className="w-full rounded-2xl border border-line px-4 py-3 text-left text-sm font-bold"
              onClick={async () => {
                try {
                  const at = await scheduleNativeTestAlarm()
                  store.showToast(`Test alarm scheduled for ${at.toLocaleTimeString()}. Lock the screen to test it.`)
                } catch (e) {
                  console.error('Could not schedule native test alarm', e)
                  store.showToast(e instanceof Error ? e.message : 'Could not schedule the test alarm.')
                }
              }}>
              Schedule a 2-minute notification test
            </button>
          )}
          {notifMsg && <p role="status" className="text-sm font-semibold text-[#C23B35]">{notifMsg}</p>}
          <p className="rounded-2xl bg-[#FFF7D1] p-3 text-xs font-semibold text-ink-soft">{nativeAndroid
            ? 'Android reminders use exact wake-up alarms and require Alarms & reminders access. Up to 450 upcoming reminders are queued; opening Daybloom refreshes the 14-day schedule. Notification sounds follow Android channel settings and the phone’s notification volume. Use the 2-minute test to check delivery while locked.'
            : 'Sounds play while Daybloom is open (or recently open) on this device. A web app can’t promise alerts once it is fully closed or the phone is asleep — keep the app open for reliable chimes.'}</p>
        </Section>

        <Section title="Focus Blocks">
          <div className="flex items-center justify-between gap-3"><span className="font-bold">Tasks shown</span>
            <Segmented label="Tasks shown in a Focus Block" value={s.focusCount} options={[{ value: 2, label: '2' }, { value: 3, label: '3' }]} onChange={(v) => store.updateSettings({ focusCount: v })} /></div>
        </Section>

        <Section title="Appearance">
          <div className="flex items-center justify-between gap-3"><span className="font-bold">Clock</span>
            <Segmented label="Time format" value={s.timeFormat} options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} onChange={(v) => store.updateSettings({ timeFormat: v })} /></div>
          <div className="flex items-center justify-between gap-3"><span className="font-bold">Light haptics</span><Toggle on={s.haptics} label="Haptics" onChange={(haptics) => store.updateSettings({ haptics })} /></div>
          <p className="text-xs font-semibold text-ink-faint">Animations follow your device’s “reduce motion” setting.</p>
        </Section>

        <Section title="Your data">
          <p className="text-sm font-semibold text-ink-soft">Everything is stored only on this device. Export a backup now and then.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-soft" onClick={exportJson}><Download size={18} />Export</button>
            <button className="btn-soft" onClick={() => file.current?.click()}><Upload size={18} />Import</button>
            <button className="btn-soft text-[#C23B35]" onClick={() => setClearing(true)}><Trash2 size={18} />Clear all</button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          {error && <p role="alert" className="text-sm font-bold text-[#C23B35]">{error}</p>}
        </Section>

        {canInstall && <Section title="Install"><button className="btn-primary" onClick={() => void promptInstall()}><Smartphone size={18} />Install Daybloom</button></Section>}
        <p className="px-2 text-center text-xs font-semibold text-ink-faint">On iPhone: Share → Add to Home Screen.</p>
      </div>

      {pending && (
        <Sheet title="Replace your data?" onClose={() => setPending(null)} footer={<div className="flex gap-2"><button className="btn-soft flex-1" onClick={() => setPending(null)}>Cancel</button><button className="btn-primary flex-1" onClick={async () => { await store.replaceAll(pending.data, pending.settings); setPending(null); store.showToast('Backup restored') }}>Replace</button></div>}>
          <p className="pb-3 text-sm font-semibold text-ink-soft">The backup contains {count(pending.data)}. Importing replaces what is on this device now ({count(st.data)}). This can’t be undone — export first if unsure.</p>
        </Sheet>
      )}
      {clearing && (
        <Sheet title="Delete everything?" onClose={() => setClearing(false)} footer={<div className="flex gap-2"><button className="btn-soft flex-1" onClick={() => setClearing(false)}>Keep my data</button><button className="btn-primary !bg-[#FFB4AE] flex-1" onClick={async () => { await store.clearAll(); setClearing(false); store.showToast('All data deleted') }}>Delete all</button></div>}>
          <p className="pb-3 text-sm font-semibold text-ink-soft">This permanently removes all activities, tasks, history and settings from this device. It can’t be undone.</p>
        </Sheet>
      )}
    </div>
  )
}

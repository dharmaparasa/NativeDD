import { useEffect, useState } from 'react'
import { CalendarDays, CheckCheck, Inbox as InboxIcon, Settings as Cog } from 'lucide-react'
import DayView from './components/DayView'
import Inbox from './components/Inbox'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'
import { store, useStore } from './lib/store'
import { useNotifier, isTyping } from './hooks'

type Tab = 'day' | 'inbox' | 'history' | 'settings'
const TABS = [
  { id: 'day' as const, label: 'Day', Icon: CalendarDays },
  { id: 'inbox' as const, label: 'Inbox', Icon: InboxIcon },
  { id: 'history' as const, label: 'History', Icon: CheckCheck },
  { id: 'settings' as const, label: 'Settings', Icon: Cog },
]

function Toast() {
  const { toast } = useStore()
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => store.dismissToast(), 6000)
    return () => clearTimeout(t)
  }, [toast])
  if (!toast) return null
  return (
    <div key={toast.id} role="status" className="anim-pop fixed inset-x-0 bottom-[calc(5.2rem+var(--safe-b))] z-[70] flex justify-center px-4 md:bottom-8 md:pl-24">
      <div className="flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-sm font-bold text-white shadow-soft">
        <span className="min-w-0 truncate">{toast.message}</span>
        {toast.action && (
          <button className="rounded-full bg-sun px-3.5 py-1.5 font-extrabold text-ink active:scale-95" onClick={() => (toast.action === 'undo' ? store.undo() : store.redo())}>
            {toast.action === 'undo' ? 'Undo' : 'Redo'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const st = useStore()
  const [tab, setTab] = useState<Tab>('day')
  useNotifier()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isTyping()) return
      e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!st.ready) return <div className="flex h-full items-center justify-center text-ink-soft" aria-busy="true">Opening your day…</div>
  const inbox = Object.keys(st.data.tasks).length
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <main className="relative min-h-0 flex-1 md:order-2">
        {tab === 'day' && <DayView />}
        {tab === 'inbox' && <Inbox />}
        {tab === 'history' && <HistoryView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <nav aria-label="Main" className="z-40 flex shrink-0 justify-around border-t border-line bg-cream/95 pb-[var(--safe-b)] backdrop-blur md:order-1 md:w-24 md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:px-2 md:pt-6">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id
          return (
            <button key={id} aria-current={on ? 'page' : undefined} onClick={() => setTab(id)}
              className={`relative my-1 flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-extrabold transition active:scale-95 ${on ? 'bg-sky text-ink' : 'text-ink-faint hover:bg-[#FFF1D6]'}`}>
              <Icon size={22} strokeWidth={on ? 2.6 : 2} />{label}
              {id === 'inbox' && inbox > 0 && <span className="absolute right-2 top-0.5 min-w-[18px] rounded-full bg-sun px-1 text-center text-[10px] font-black leading-[18px] text-ink" aria-label={`${inbox} tasks`}>{inbox}</span>}
            </button>
          )
        })}
      </nav>
      <Toast />
    </div>
  )
}

import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../lib/store'
import { cmd } from '../lib/commands'
import { fmtTime, minutesOfDay, relativeDay, toDateStr } from '../lib/time'

export default function HistoryView() {
  const st = useStore()
  const groups = useMemo(() => {
    const list = Object.values(st.data.completed).sort((a, b) => b.completedAt - a.completedAt)
    const m = new Map<string, typeof list>()
    for (const t of list) { const d = toDateStr(new Date(t.completedAt)); m.set(d, [...(m.get(d) ?? []), t]) }
    return [...m.entries()]
  }, [st.data.completed])
  const total = Object.keys(st.data.completed).length
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="px-5 pb-2 pt-[calc(1rem+var(--safe-t))]">
        <h1 className="text-2xl font-black">Completed</h1>
        <p className="text-sm font-semibold text-ink-soft">{total === 0 ? 'Finished tasks will rest here.' : `${total} finished · restore any of them`}</p>
      </header>
      <div className="hide-scroll flex-1 overflow-y-auto px-4 pb-32">
        {groups.map(([d, items]) => (
          <section key={d} className="mb-4">
            <h2 className="mb-1.5 px-1 text-sm font-extrabold text-ink-soft">{relativeDay(d)}</h2>
            <ul className="space-y-2">
              {items.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-[#F1FAF5] py-1.5 pl-4 pr-1.5 shadow-card">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink-soft line-through decoration-[#3FBF88]/60">{t.title}</div>
                    <div className="text-xs font-semibold text-ink-faint">{fmtTime(minutesOfDay(new Date(t.completedAt)))}</div>
                  </div>
                  <button className="btn-ghost px-3 py-2 text-sm" onClick={() => cmd.restoreTask(t.id)} aria-label={`Restore “${t.title}”`}><RotateCcw size={16} />Restore</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Sheet } from './ui'
import type { Occurrence } from '../lib/types'
import { cmd } from '../lib/commands'
import { WEEKDAY_SHORT } from '../lib/recurrence'
import { addDays, eachDate, fmtFull, fmtTime, weekStart, weekdayOf } from '../lib/time'

export interface BulkCfg { title: string; sources: Occurrence[]; from: string; to: string; today: string }

export default function BulkSheet({ cfg, onClose }: { cfg: BulkCfg; onClose: () => void }) {
  const [from, setFrom] = useState(cfg.from)
  const [to, setTo] = useState(cfg.to)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const dates = useMemo(() => eachDate(from, to > from ? to : from, 366).filter((d) => days.includes(weekdayOf(d))), [from, to, days])
  const plan = useMemo(() => cmd.planCopy(cfg.sources, dates), [cfg.sources, dates])
  const n = plan.items.length
  const ws = weekStart(cfg.today)
  const presets = [
    { l: 'Next 7 days', f: addDays(cfg.today, 1), t: addDays(cfg.today, 7) },
    { l: 'Rest of this week', f: addDays(cfg.today, 1), t: addDays(ws, 6) },
    { l: 'Next week', f: addDays(ws, 7), t: addDays(ws, 13) },
  ]
  const apply = () => { cmd.bulkCopy(plan.items); onClose() }
  return (
    <Sheet title={cfg.title} onClose={onClose} footer={<button className="btn-primary w-full py-3 text-lg" disabled={n === 0} onClick={apply}>{n === 0 ? 'Nothing to create' : `Create ${n} ${n === 1 ? 'activity' : 'activities'}`}</button>}>
      <div className="flex flex-col gap-3.5">
        <div className="rounded-2xl border border-line bg-white p-3 text-sm">
          <div className="mb-1 font-extrabold">Copying</div>
          {cfg.sources.length === 0 && <p className="text-ink-soft">There is nothing scheduled to copy.</p>}
          <ul className="space-y-0.5 text-ink-soft">
            {cfg.sources.slice(0, 4).map((s) => <li key={s.key} className="truncate">{fmtTime(s.startMin)}–{fmtTime(s.endMin)} · {s.title}</li>)}
            {cfg.sources.length > 4 && <li>+{cfg.sources.length - 4} more</li>}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => <button key={p.l} className="btn-soft px-3 py-1.5 text-sm" onClick={() => { setFrom(p.f); setTo(p.t) }}>{p.l}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold text-ink-soft">From<input className="field mt-1" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="block text-sm font-bold text-ink-soft">To<input className="field mt-1" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
        <div role="group" aria-label="On these weekdays" className="flex justify-between gap-1">
          {WEEKDAY_SHORT.map((d, i) => (
            <button key={d} aria-label={d} aria-pressed={days.includes(i)} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
              className={`h-10 w-10 rounded-full text-sm font-extrabold transition ${days.includes(i) ? 'bg-sun text-ink shadow-card' : 'border border-line bg-white text-ink-soft'}`}>{d[0]}</button>
          ))}
        </div>
        <div role="status" className="rounded-2xl bg-[#E2F7EC] px-3 py-2.5 text-sm font-semibold">
          {dates.length === 0 ? 'No matching days in that range.' : <>Will create <b>{n}</b> {n === 1 ? 'activity' : 'activities'} across <b>{dates.length}</b> {dates.length === 1 ? 'day' : 'days'} ({fmtFull(dates[0])}{dates.length > 1 ? ` – ${fmtFull(dates[dates.length - 1])}` : ''}).
            {plan.skipped > 0 && <> {plan.skipped} already {plan.skipped === 1 ? 'exists' : 'exist'} and will be skipped.</>}</>}
        </div>
        <p className="text-xs text-ink-faint">Existing activities are never changed. You can undo this in one tap.</p>
      </div>
    </Sheet>
  )
}

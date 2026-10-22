import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Target } from 'lucide-react'
import { Sheet } from './ui'
import type { ColorKey, Freq, Occurrence, Recurrence } from '../lib/types'
import type { Scope } from '../lib/activities'
import { conflictsWith, DEFAULT_TITLE, normalizeTimes } from '../lib/activities'
import { COLORS, COLOR_KEYS } from '../lib/colors'
import { NO_REPEAT, WEEKDAY_SHORT } from '../lib/recurrence'
import { fmtTime, fromInputValue, toInputValue, weekdayOf } from '../lib/time'

export interface Draft { title: string; startMin: number; endMin: number; date: string; recurrence: Recurrence; color?: ColorKey; kind: 'activity' | 'focus' }
interface Props {
  mode: 'create' | 'edit'
  occ?: Occurrence
  initial: Draft
  occsOn: (date: string) => Occurrence[]
  onSave: (d: Draft, scope: Scope) => void
  onClose: () => void
}

export default function ActivitySheet({ mode, occ, initial, occsOn, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [start, setStart] = useState(initial.startMin)
  const [end, setEnd] = useState(initial.endMin)
  const [date, setDate] = useState(initial.date)
  const [rec, setRec] = useState<Recurrence>(initial.recurrence)
  const [color, setColor] = useState<ColorKey | undefined>(initial.color)
  const [kind, setKind] = useState(initial.kind)
  const [more, setMore] = useState(initial.kind === 'focus')
  const [askScope, setAskScope] = useState(false)

  const t = normalizeTimes(start, end)
  const conflicts = useMemo(() => conflictsWith(occsOn(date), t.startMin, t.endMin, occ?.key), [occsOn, date, t.startMin, t.endMin, occ?.key])
  const draft = (): Draft => ({ title, ...t, date, recurrence: rec, color, kind })
  const submit = () => { if (mode === 'edit' && occ?.recurring) setAskScope(true); else onSave(draft(), 'all') }

  const setFreq = (freq: Freq) => setRec({ freq, weekdays: freq === 'weekly' ? [weekdayOf(date)] : [], until: rec.until })
  const toggleDay = (d: number) => {
    const has = rec.weekdays.includes(d)
    if (has && rec.weekdays.length === 1) return
    setRec({ ...rec, weekdays: has ? rec.weekdays.filter((x) => x !== d) : [...rec.weekdays, d].sort() })
  }

  if (askScope) {
    const opts: { v: Scope; l: string }[] = [{ v: 'this', l: 'This occurrence only' }, { v: 'future', l: 'This and following' }, { v: 'all', l: 'Entire series' }]
    return (
      <Sheet title="Save changes to…" onClose={() => setAskScope(false)}>
        <div className="flex flex-col gap-2 pb-3">{opts.map((o) => <button key={o.v} className="btn-soft justify-start" onClick={() => onSave(draft(), o.v)}>{o.l}</button>)}</div>
      </Sheet>
    )
  }

  return (
    <Sheet title={mode === 'create' ? 'New activity' : 'Edit activity'} onClose={onClose}
      footer={<button className="btn-primary w-full py-3 text-lg" onClick={submit}>{mode === 'create' ? 'Add to my day' : 'Save'}</button>}>
      <div className="flex flex-col gap-3.5" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') { e.preventDefault(); submit() } }}>
        <label className="block">
          <span className="sr-only">Activity name</span>
          <input className="field text-lg font-bold" type="text" autoFocus={mode === 'create'} value={title} maxLength={80}
            placeholder={kind === 'focus' ? 'Focus Block' : DEFAULT_TITLE} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold text-ink-soft">Starts
            <input className="field mt-1" type="time" value={toInputValue(start)}
              onChange={(e) => { const s = fromInputValue(e.target.value, start); setEnd(Math.min(1439, s + Math.max(15, end - start))); setStart(s) }} />
          </label>
          <label className="block text-sm font-bold text-ink-soft">Ends
            <input className="field mt-1" type="time" value={toInputValue(end)} onChange={(e) => setEnd(fromInputValue(e.target.value, end))} />
          </label>
        </div>
        <label className="block text-sm font-bold text-ink-soft">Repeat
          <select className="field mt-1" value={rec.freq} onChange={(e) => setFreq(e.target.value as Freq)}>
            <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </label>
        {rec.freq === 'weekly' && (
          <div role="group" aria-label="Repeat on" className="flex justify-between gap-1">
            {WEEKDAY_SHORT.map((d, i) => (
              <button key={d} aria-pressed={rec.weekdays.includes(i)} aria-label={d} onClick={() => toggleDay(i)}
                className={`h-10 w-10 rounded-full text-sm font-extrabold transition ${rec.weekdays.includes(i) ? 'bg-sun text-ink shadow-card' : 'bg-white text-ink-soft border border-line'}`}>{d[0]}</button>
            ))}
          </div>
        )}
        {rec.freq === 'monthly' && <p className="-mt-1 text-sm text-ink-faint">On months without this day, it moves to the last day of the month.</p>}
        {rec.freq === 'yearly' && <p className="-mt-1 text-sm text-ink-faint">A Feb 29 activity happens on Feb 28 in non-leap years.</p>}

        {conflicts.length > 0 && (
          <div role="status" className="flex items-start gap-2 rounded-2xl bg-[#FFF1D6] px-3 py-2 text-sm font-semibold">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#C98A00]" />
            <span>Overlaps with {conflicts.slice(0, 2).map((c) => `${c.title} (${fmtTime(c.startMin)}–${fmtTime(c.endMin)})`).join(', ')}{conflicts.length > 2 ? ` +${conflicts.length - 2}` : ''}. You can still save.</span>
          </div>
        )}

        <button className="btn-ghost -mx-2 self-start text-sm" aria-expanded={more} onClick={() => setMore(!more)}>
          More options <ChevronDown size={16} className={`transition ${more ? 'rotate-180' : ''}`} />
        </button>
        {more && (
          <div className="anim-fade flex flex-col gap-3.5">
            <label className="block text-sm font-bold text-ink-soft">Date
              <input className="field mt-1" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
            <div role="radiogroup" aria-label="Color" className="flex gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button key={k} role="radio" aria-checked={color === k} aria-label={COLORS[k].name} onClick={() => setColor(k)}
                  className="h-9 w-9 rounded-full border-2 transition active:scale-90" style={{ background: COLORS[k].bg, borderColor: color === k ? COLORS[k].accent : COLORS[k].border, boxShadow: color === k ? `0 0 0 3px ${COLORS[k].accent}33` : undefined }} />
              ))}
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#3FBF88]" checked={kind === 'focus'} disabled={mode === 'edit'} onChange={(e) => setKind(e.target.checked ? 'focus' : 'activity')} />
              <span><span className="flex items-center gap-1.5 font-extrabold"><Target size={16} /> Focus Block</span>
                <span className="text-sm text-ink-soft">Shows your next top tasks from the Inbox{mode === 'edit' ? ' (set when created)' : ''}.</span></span>
            </label>
            {mode === 'edit' && occ?.recurring && date !== initial.date && <p className="text-sm text-ink-faint">Changing the date moves only the part of the series you choose when you save.</p>}
          </div>
        )}
      </div>
    </Sheet>
  )
}
export const blankRecurrence = NO_REPEAT

import type { Activity, Occurrence, Recurrence } from './types'
import { addDays, dateParts, daysInMonth, fmtMonthDay, weekdayOf } from './time'

export const NO_REPEAT: Recurrence = { freq: 'none', weekdays: [] }
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_SHORT = DAY

/**
 * Does the series occur on `date`? (Ignores exceptions.)
 * Monthly on the 29th–31st falls back to the month's last day; yearly Feb 29
 * falls back to Feb 28 in non-leap years. Predictable, never skipped.
 */
export function occursOn(a: Activity, date: string): boolean {
  const r = a.recurrence
  if (date < a.date) return false
  if (r.until && date > r.until) return false
  const d = dateParts(date), anchor = dateParts(a.date)
  switch (r.freq) {
    case 'none': return date === a.date
    case 'daily': return true
    case 'weekly': return (r.weekdays.length ? r.weekdays : [weekdayOf(a.date)]).includes(weekdayOf(date))
    case 'monthly': return d.d === Math.min(anchor.d, daysInMonth(d.y, d.m))
    case 'yearly': return d.m === anchor.m && d.d === Math.min(anchor.d, daysInMonth(d.y, anchor.m))
  }
}

export function resolveOccurrence(a: Activity, date: string): Occurrence | null {
  if (!occursOn(a, date)) return null
  const ex = a.exceptions[date]
  if (ex?.deleted) return null
  const o = ex?.override ?? {}
  return {
    key: `${a.id}@${date}`, activityId: a.id, date, kind: a.kind,
    title: o.title ?? a.title, color: o.color ?? a.color,
    startMin: o.startMin ?? a.startMin, endMin: o.endMin ?? a.endMin,
    recurring: a.recurrence.freq !== 'none',
  }
}

export function occurrencesOn(activities: Activity[], date: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const a of activities) { const o = resolveOccurrence(a, date); if (o) out.push(o) }
  return out.sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin || x.title.localeCompare(y.title))
}

export function shiftRecurrence(r: Recurrence, deltaDays: number): Recurrence {
  if (r.freq !== 'weekly' || !deltaDays) return r
  return { ...r, weekdays: r.weekdays.map((d) => (((d + deltaDays) % 7) + 7) % 7).sort() }
}

const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
export function describeRecurrence(r: Recurrence, anchor: string): string {
  switch (r.freq) {
    case 'none': return 'Does not repeat'
    case 'daily': return 'Every day'
    case 'weekly': {
      const days = (r.weekdays.length ? r.weekdays : [weekdayOf(anchor)]).slice().sort()
      return days.length === 7 ? 'Every day' : `Every ${days.map((d) => DAY[d]).join(', ')}`
    }
    case 'monthly': return `Monthly on the ${ordinal(dateParts(anchor).d)}`
    case 'yearly': return `Every year on ${fmtMonthDay(anchor)}`
  }
}
export const prevDay = (s: string) => addDays(s, -1)

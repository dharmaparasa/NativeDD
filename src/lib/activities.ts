import type { Activity, ColorKey, Exception, Occurrence, Op, Recurrence } from './types'
import { uid } from './types'
import { COLOR_KEYS } from './colors'
import { NO_REPEAT, occurrencesOn, prevDay, shiftRecurrence } from './recurrence'
import { addDays, ceilTo, daysBetween, minutesOfDay } from './time'

export const DEFAULT_TITLE = 'New activity'
export const defaultTitle = (kind: Activity['kind']) => (kind === 'focus' ? 'Focus Block' : DEFAULT_TITLE)
export type Scope = 'this' | 'future' | 'all'

/** Keep times valid: 0 ≤ start < end ≤ 23:59. A missing/invalid end becomes start + 1 hour. */
export function normalizeTimes(start: number, end?: number) {
  const s = Math.max(0, Math.min(1438, Math.round(start)))
  const e = end === undefined || !(end > s) ? Math.min(s + 60, 1439) : Math.min(1439, Math.round(end))
  return { startMin: s, endMin: e }
}

/** Starting values for a new activity — tapped time, or the next quarter-hour. */
export function draftFor(opts: { date: string; startMin?: number; now?: Date }) {
  const start = opts.startMin ?? ceilTo(minutesOfDay(opts.now ?? new Date()), 15)
  return { title: '', date: opts.date, ...normalizeTimes(start), recurrence: NO_REPEAT, color: undefined as ColorKey | undefined, kind: 'activity' as const }
}

export function makeActivity(p: Partial<Activity> & { date: string }): Activity {
  const kind = p.kind ?? 'activity'
  const t = normalizeTimes(p.startMin ?? 540, p.endMin)
  return {
    id: p.id ?? uid(), title: (p.title ?? '').trim() || defaultTitle(kind), kind,
    color: p.color ?? (kind === 'focus' ? 'lemon' : COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]),
    ...t, date: p.date, recurrence: p.recurrence ?? NO_REPEAT, exceptions: {}, hiddenTasks: {},
    batchId: p.batchId, createdAt: p.createdAt ?? Date.now(),
  }
}
export const createOps = (a: Activity): Op[] => [{ table: 'activities', id: a.id, after: a }]

export interface EditPatch { title: string; startMin: number; endMin: number; color: ColorKey; kind: Activity['kind']; recurrence: Recurrence; date: string }
const before = <T extends Record<string, unknown>>(m: T, date: string) => Object.fromEntries(Object.entries(m).filter(([k]) => k < date)) as T
const withException = (a: Activity, date: string, ex: Exception): Activity => ({ ...a, exceptions: { ...a.exceptions, [date]: ex } })
const upd = (a: Activity, n: Activity): Op => ({ table: 'activities', id: n.id, before: a, after: n })

/** Edit one occurrence, this-and-future, or the whole series. Recurrence is a rule + exceptions; nothing is copied per day. */
export function editOps(a: Activity, date: string, scope: Scope, p: EditPatch): Op[] {
  const t = normalizeTimes(p.startMin, p.endMin)
  const title = p.title.trim() || defaultTitle(p.kind)
  if (a.recurrence.freq === 'none') return [upd(a, { ...a, title, ...t, color: p.color, kind: p.kind, recurrence: p.recurrence, date: p.date })]
  if (scope === 'future' && date <= a.date) scope = 'all'
  if (scope === 'this') {
    if (p.date === date) return [upd(a, withException(a, date, { override: { title, ...t, color: p.color } }))]
    const moved = makeActivity({ title, ...t, color: p.color, kind: a.kind, date: p.date })
    return [upd(a, withException(a, date, { deleted: true })), { table: 'activities', id: moved.id, after: moved }]
  }
  const delta = daysBetween(date, p.date)
  const rec = { ...shiftRecurrence(p.recurrence, delta), until: a.recurrence.until }
  if (scope === 'all') return [upd(a, { ...a, title, ...t, color: p.color, kind: p.kind, recurrence: rec, date: addDays(a.date, delta) })]
  const head: Activity = { ...a, recurrence: { ...a.recurrence, until: prevDay(date) }, exceptions: before(a.exceptions, date), hiddenTasks: before(a.hiddenTasks, date) }
  const tail = makeActivity({ title, ...t, color: p.color, kind: p.kind, date: p.date, recurrence: rec })
  return [upd(a, head), { table: 'activities', id: tail.id, after: tail }]
}

export function deleteOps(a: Activity, date: string, scope: Scope): Op[] {
  const del: Op[] = [{ table: 'activities', id: a.id, before: a }]
  if (a.recurrence.freq === 'none' || scope === 'all') return del
  if (scope === 'this') return [upd(a, withException(a, date, { deleted: true }))]
  if (date <= a.date) return del
  return [upd(a, { ...a, recurrence: { ...a.recurrence, until: prevDay(date) }, exceptions: before(a.exceptions, date), hiddenTasks: before(a.hiddenTasks, date) })]
}

export function setHiddenOps(a: Activity, date: string, ids: string[]): Op[] {
  const hiddenTasks = { ...a.hiddenTasks }
  if (ids.length) hiddenTasks[date] = ids; else delete hiddenTasks[date]
  return [upd(a, { ...a, hiddenTasks })]
}

/** Plan copying `sources` onto `dates` as separate one-off activities. Exact duplicates are skipped. */
export function planBulkCopy(existing: Activity[], sources: Occurrence[], dates: string[], batchId: string) {
  const items: Activity[] = []
  let skipped = 0
  for (const date of dates) {
    const have = occurrencesOn(existing, date)
    for (const s of sources) {
      if (have.some((o) => o.title === s.title && o.startMin === s.startMin && o.endMin === s.endMin)) { skipped++; continue }
      items.push(makeActivity({ title: s.title, startMin: s.startMin, endMin: s.endMin, color: s.color, kind: s.kind, date, batchId }))
    }
  }
  return { items, skipped }
}
export const bulkOps = (items: Activity[]): Op[] => items.map((a) => ({ table: 'activities', id: a.id, after: a }))

export const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE
export const conflictsWith = (occs: Occurrence[], start: number, end: number, ignoreKey?: string) =>
  occs.filter((o) => o.key !== ignoreKey && overlaps(start, end, o.startMin, o.endMin))

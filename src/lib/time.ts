export type TimeFormat = '12h' | '24h'
let timeFormat: TimeFormat = '12h'
export const setTimeFormat = (f: TimeFormat) => { timeFormat = f }

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const todayStr = (d = new Date()) => toDateStr(d)
export function dateParts(s: string) { const [y, m, d] = s.split('-').map(Number); return { y, m, d } }
export function parseDate(s: string) { const { y, m, d } = dateParts(s); return new Date(y, m - 1, d) }
export function addDays(s: string, n: number) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d) }
export function daysBetween(a: string, b: string) {
  const pa = dateParts(a), pb = dateParts(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000)
}
export const weekdayOf = (s: string) => parseDate(s).getDay()
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()
export const minutesOfDay = (d = new Date()) => d.getHours() * 60 + d.getMinutes()
/** Local timestamp of `min` minutes after midnight on `date` (DST-safe). */
export function atMs(date: string, min: number) {
  const { y, m, d } = dateParts(date)
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime()
}
export function weekStart(s: string) { return addDays(s, -((weekdayOf(s) + 6) % 7)) } // Monday
export function eachDate(from: string, to: string, max = 400) {
  const out: string[] = []
  for (let d = from; d <= to && out.length < max; d = addDays(d, 1)) out.push(d)
  return out
}

export function fmtTime(min: number, fmt: TimeFormat = timeFormat) {
  const m = Math.max(0, Math.min(1439, Math.round(min)))
  const h = Math.floor(m / 60), mm = m % 60
  if (fmt === '24h') return `${pad2(h)}:${pad2(mm)}`
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(mm)} ${h < 12 ? 'AM' : 'PM'}`
}
export function fmtHourLabel(h: number, fmt: TimeFormat = timeFormat) {
  if (fmt === '24h') return `${pad2(h)}:00`
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}
export const toInputValue = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
export function fromInputValue(v: string, fallback: number) {
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : fallback
}
/** Round up to the next `step` minutes, never past 23:59. */
export const ceilTo = (min: number, step = 15) => Math.min(1439, Math.ceil(min / step) * step)

export function fmtWeekday(s: string) { return parseDate(s).toLocaleDateString(undefined, { weekday: 'long' }) }
export function fmtMonthDay(s: string) { return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
export function fmtFull(s: string) { return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }
export function relativeDay(s: string, today = todayStr()) {
  const n = daysBetween(today, s)
  if (n === 0) return 'Today'
  if (n === -1) return 'Yesterday'
  if (n === 1) return 'Tomorrow'
  return fmtFull(s)
}

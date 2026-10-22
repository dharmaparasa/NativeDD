import type { Occurrence } from './types'
import { atMs, fmtTime } from './time'

export type EventKind = 'hourly' | 'start' | 'end'
export interface NotifyEvent { key: string; kind: EventKind; at: number; title: string; body?: string }

/** Every sound-worthy event for one local date. Keys are stable, so they can be de-duplicated forever. */
export function buildEvents(date: string, occs: Occurrence[]): NotifyEvent[] {
  const ev: NotifyEvent[] = []
  for (let h = 0; h < 24; h++) ev.push({ key: `hour:${date}:${h}`, kind: 'hourly', at: atMs(date, h * 60), title: fmtTime(h * 60) })
  for (const o of occs) {
    ev.push({ key: `start:${o.activityId}:${date}:${o.startMin}`, kind: 'start', at: atMs(date, o.startMin), title: o.title, body: `Starts now · until ${fmtTime(o.endMin)}` })
    ev.push({ key: `end:${o.activityId}:${date}:${o.endMin}`, kind: 'end', at: atMs(date, o.endMin), title: o.title, body: 'Finished' })
  }
  return ev.sort((a, b) => a.at - b.at)
}

/**
 * Events that are due and not yet recorded. Everything due is marked as fired,
 * but only events within `graceMs` of now actually play: after sleep or a
 * throttled background tab we never replay a pile of missed chimes.
 */
export function selectDue(events: NotifyEvent[], now: number, fired: ReadonlySet<string>, graceMs = 90_000) {
  const due = events.filter((e) => e.at <= now && !fired.has(e.key))
  return { play: due.filter((e) => now - e.at <= graceMs), mark: due.map((e) => e.key) }
}
/** Overlapping events: at most one sound per kind per tick (hourly, then end, then start). */
export function coalesce(play: NotifyEvent[]): NotifyEvent[] {
  const order: EventKind[] = ['hourly', 'end', 'start']
  return order.flatMap((k) => { const e = play.filter((p) => p.kind === k); return e.length ? [e[e.length - 1]] : [] })
}

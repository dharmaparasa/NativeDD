import { describe, expect, it } from 'vitest'
import { resolveBase } from '../build/base.js'
import type { Activity, Data } from '../src/lib/types'
import { emptyData } from '../src/lib/types'
import { makeActivity, draftFor, normalizeTimes, editOps, deleteOps, planBulkCopy, bulkOps, conflictsWith, DEFAULT_TITLE } from '../src/lib/activities'
import { occursOn, occurrencesOn, describeRecurrence } from '../src/lib/recurrence'
import { layoutOverlaps, yToMinutes, HOUR_H } from '../src/lib/timeline'
import { DoubleTap, isTap, swipeDirection } from '../src/lib/gestures'
import { addTaskOps, completeOps, focusTasks, insertIndexFor, reorderOps, restoreOps, sortTasks } from '../src/lib/priority'
import { History, applyTxn } from '../src/lib/undo'
import { buildEvents, coalesce, selectDue } from '../src/lib/notify'
import { soundRecipe } from '../src/lib/sound'
import { parseBackup, makeBackup } from '../src/lib/backup'
import { DEFAULT_SETTINGS } from '../src/lib/types'
import { addDays, atMs } from '../src/lib/time'
import { buildNativeSchedule } from '../src/lib/nativeNotifications'

const act = (p: Partial<Activity> & { date: string }) => makeActivity({ title: 'A', startMin: 540, endMin: 600, color: 'sky', ...p })
const run = (d: Data, ops: Parameters<typeof applyTxn>[1]) => applyTxn(d, ops, 'do').data

describe('GitHub Pages base path', () => {
  it('derives the repo path in Actions, "/" for user sites and locally', () => {
    expect(resolveBase({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'me/daybloom' })).toBe('/daybloom/')
    expect(resolveBase({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'me/me.github.io' })).toBe('/')
    expect(resolveBase({})).toBe('/')
    expect(resolveBase({ BASE_PATH: 'planner' })).toBe('/planner/')
  })
})

describe('double-tap creation and defaults', () => {
  it('detects two quick nearby taps only', () => {
    const d = new DoubleTap()
    expect(d.register(100, 100, 0)).toBe(false)
    expect(d.register(105, 102, 200)).toBe(true)
    expect(d.register(100, 100, 1000)).toBe(false)
    expect(d.register(100, 100, 1600)).toBe(false) // too slow
    expect(d.register(300, 300, 1700)).toBe(false) // too far
    expect(isTap(2, 3)).toBe(true); expect(isTap(30, 0)).toBe(false)
  })
  it('maps tap position to a snapped time', () => {
    expect(yToMinutes(10 * HOUR_H + 5)).toBe(600)
    expect(yToMinutes(10 * HOUR_H + HOUR_H * 0.3)).toBe(600 + 15)
    expect(yToMinutes(-50)).toBe(0)
  })
  it('fills blanks: name, +1h end, no repeat', () => {
    const a = makeActivity({ date: '2026-10-22', startMin: 600 })
    expect(a.title).toBe(DEFAULT_TITLE); expect(a.endMin).toBe(660); expect(a.recurrence.freq).toBe('none')
    expect(normalizeTimes(1400, 1300)).toEqual({ startMin: 1400, endMin: 1439 })
  })
  it('add button defaults to the next quarter hour with a one-hour length', () => {
    const d = draftFor({ date: '2026-10-22', now: new Date(2026, 9, 22, 10, 7) })
    expect(d.startMin).toBe(615); expect(d.endMin).toBe(675)
  })
  it('swipes need distance and a mostly-horizontal path', () => {
    expect(swipeDirection(-120, 10, 200)).toBe('next'); expect(swipeDirection(120, 10, 200)).toBe('prev')
    expect(swipeDirection(-120, 150, 200)).toBeNull(); expect(swipeDirection(-30, 0, 100)).toBeNull()
  })
})

describe('recurrence', () => {
  it('daily / weekly / monthly / yearly', () => {
    const daily = act({ date: '2026-01-01', recurrence: { freq: 'daily', weekdays: [] } })
    expect(occursOn(daily, '2026-06-15')).toBe(true); expect(occursOn(daily, '2025-12-31')).toBe(false)
    const weekly = act({ date: '2026-10-19', recurrence: { freq: 'weekly', weekdays: [1, 3] } }) // Mon, Wed
    expect([0, 1, 2, 3].map((n) => occursOn(weekly, addDays('2026-10-19', n)))).toEqual([true, false, true, false])
    const monthly = act({ date: '2026-01-31', recurrence: { freq: 'monthly', weekdays: [] } })
    expect(occursOn(monthly, '2026-02-28')).toBe(true); expect(occursOn(monthly, '2026-02-27')).toBe(false); expect(occursOn(monthly, '2026-04-30')).toBe(true)
    const yearly = act({ date: '2024-02-29', recurrence: { freq: 'yearly', weekdays: [] } })
    expect(occursOn(yearly, '2025-02-28')).toBe(true); expect(occursOn(yearly, '2028-02-29')).toBe(true); expect(occursOn(yearly, '2025-03-01')).toBe(false)
    expect(describeRecurrence(weekly.recurrence, weekly.date)).toBe('Every Mon, Wed')
  })
  it('edits one occurrence without touching the series', () => {
    const a = act({ date: '2026-10-19', recurrence: { freq: 'daily', weekdays: [] } })
    const d = run({ ...emptyData(), activities: { [a.id]: a } }, editOps(a, '2026-10-21', 'this', { title: 'Moved', startMin: 700, endMin: 760, color: 'mint', kind: 'activity', recurrence: a.recurrence, date: '2026-10-21' }))
    const acts = Object.values(d.activities)
    expect(occurrencesOn(acts, '2026-10-21')[0].title).toBe('Moved')
    expect(occurrencesOn(acts, '2026-10-22')[0].title).toBe('A')
  })
  it('this-and-future splits the series; delete scopes work', () => {
    const a = act({ date: '2026-10-19', recurrence: { freq: 'daily', weekdays: [] } })
    let d = run({ ...emptyData(), activities: { [a.id]: a } }, editOps(a, '2026-10-22', 'future', { title: 'B', startMin: 600, endMin: 660, color: 'sky', kind: 'activity', recurrence: a.recurrence, date: '2026-10-22' }))
    expect(occurrencesOn(Object.values(d.activities), '2026-10-21')[0].title).toBe('A')
    expect(occurrencesOn(Object.values(d.activities), '2026-10-25')[0].title).toBe('B')
    const b = act({ date: '2026-10-19', recurrence: { freq: 'daily', weekdays: [] } })
    d = run({ ...emptyData(), activities: { [b.id]: b } }, deleteOps(b, '2026-10-21', 'this'))
    expect(occurrencesOn(Object.values(d.activities), '2026-10-21')).toHaveLength(0); expect(occurrencesOn(Object.values(d.activities), '2026-10-22')).toHaveLength(1)
    d = run({ ...emptyData(), activities: { [b.id]: b } }, deleteOps(b, '2026-10-21', 'future'))
    expect(occurrencesOn(Object.values(d.activities), '2026-10-20')).toHaveLength(1); expect(occurrencesOn(Object.values(d.activities), '2026-10-21')).toHaveLength(0)
    d = run({ ...emptyData(), activities: { [b.id]: b } }, deleteOps(b, '2026-10-21', 'all'))
    expect(Object.keys(d.activities)).toHaveLength(0)
  })
})

describe('timeline overlaps', () => {
  it('puts overlapping items side by side and keeps later ones full width', () => {
    const l = layoutOverlaps([{ id: 'a', startMin: 600, endMin: 660 }, { id: 'b', startMin: 630, endMin: 690 }, { id: 'c', startMin: 800, endMin: 860 }])
    expect(l.get('a')).toEqual({ col: 0, cols: 2 }); expect(l.get('b')).toEqual({ col: 1, cols: 2 }); expect(l.get('c')).toEqual({ col: 0, cols: 1 })
  })
  it('reports overlap warnings without blocking', () => {
    const a = act({ date: '2026-10-22', startMin: 600, endMin: 660 })
    const occs = occurrencesOn([a], '2026-10-22')
    expect(conflictsWith(occs, 630, 700)).toHaveLength(1); expect(conflictsWith(occs, 660, 700)).toHaveLength(0)
  })
})

describe('bulk creation + undo', () => {
  it('creates a week and undo removes only that batch', () => {
    const existing = act({ date: '2026-10-26', title: 'Keep me' })
    const base: Data = { ...emptyData(), activities: { [existing.id]: existing } }
    const src = occurrencesOn([act({ date: '2026-10-21', title: 'Exercise', startMin: 420, endMin: 480 })], '2026-10-21')
    const dates = Array.from({ length: 7 }, (_, i) => addDays('2026-10-26', i))
    const plan = planBulkCopy(Object.values(base.activities), src, dates, 'batch1')
    expect(plan.items).toHaveLength(7)
    const ops = bulkOps(plan.items)
    const after = applyTxn(base, ops, 'do').data
    expect(Object.keys(after.activities)).toHaveLength(8)
    const undone = applyTxn(after, ops, 'undo').data
    expect(Object.keys(undone.activities)).toEqual([existing.id])
    expect(undone.activities[existing.id]).toEqual(existing)
    expect(applyTxn(undone, ops, 'do').data).toEqual(after) // redo
  })
  it('skips exact duplicates already on a day', () => {
    const e = act({ date: '2026-10-26', title: 'Exercise', startMin: 420, endMin: 480 })
    const src = occurrencesOn([e], '2026-10-26')
    const plan = planBulkCopy([e], src, ['2026-10-26', '2026-10-27'], 'b')
    expect(plan.items).toHaveLength(1); expect(plan.skipped).toBe(1)
  })
  it('history keeps stacks and clears redo on a new action', () => {
    const h = new History(); const t = (id: string) => ({ id, label: id, ops: [] })
    h.push(t('1')); h.push(t('2')); expect(h.popUndo()?.id).toBe('2'); expect(h.canRedo).toBe(true)
    h.push(t('3')); expect(h.canRedo).toBe(false)
  })
})

describe('Priority Inbox + Focus Blocks', () => {
  const build = (titles: string[]) => {
    let data = emptyData()
    for (const t of titles) {
      const sorted = sortTasks(Object.values(data.tasks))
      data = run(data, addTaskOps(sorted, t, sorted.length).ops)
    }
    return data
  }
  const names = (d: Data) => sortTasks(Object.values(d.tasks)).map((t) => t.title)
  it('inserts top / middle / bottom', () => {
    expect([0, 1, 2, 3, 4].map((n) => insertIndexFor(n, 'middle'))).toEqual([0, 1, 1, 2, 2])
    let d = build(['a', 'b', 'c', 'd'])
    const s = sortTasks(Object.values(d.tasks))
    d = run(d, addTaskOps(s, 'mid', insertIndexFor(4, 'middle')).ops); expect(names(d)).toEqual(['a', 'b', 'mid', 'c', 'd'])
    d = run(d, addTaskOps(sortTasks(Object.values(d.tasks)), 'top', 0).ops); expect(names(d)[0]).toBe('top')
  })
  it('reorders with one change and keeps the exact order', () => {
    let d = build(['a', 'b', 'c', 'd'])
    const s = sortTasks(Object.values(d.tasks))
    const ops = reorderOps(s, s[3].id, 0); expect(ops).toHaveLength(1)
    d = run(d, ops); expect(names(d)).toEqual(['d', 'a', 'b', 'c'])
    expect(names(applyTxn(d, ops, 'undo').data)).toEqual(['a', 'b', 'c', 'd'])
    const s2 = sortTasks(Object.values(d.tasks)); d = run(d, reorderOps(s2, s2[0].id, 2)); expect(names(d)).toEqual(['a', 'b', 'd', 'c'])
  })
  it('survives many reorders at one spot (renormalises)', () => {
    let d = build(['a', 'b', 'c'])
    for (let i = 0; i < 80; i++) { const s = sortTasks(Object.values(d.tasks)); d = run(d, reorderOps(s, s[2].id, 1)) }
    expect(names(d).sort()).toEqual(['a', 'b', 'c'])
    const o = sortTasks(Object.values(d.tasks)).map((t) => t.order); expect(new Set(o).size).toBe(3)
  })
  it('completing inside a Focus Block shows the next task; undo brings it back; history keeps it', () => {
    let d = build(['t1', 't2', 't3', 't4'])
    let sorted = sortTasks(Object.values(d.tasks))
    expect(focusTasks(sorted, [], 3).map((t) => t.title)).toEqual(['t1', 't2', 't3'])
    expect(focusTasks(sorted, ['x'], 2).map((t) => t.title)).toEqual(['t1', 't2'])
    const ops = completeOps(sorted[0], 12345)
    d = run(d, ops); sorted = sortTasks(Object.values(d.tasks))
    expect(focusTasks(sorted, [], 3).map((t) => t.title)).toEqual(['t2', 't3', 't4'])
    expect(Object.values(d.completed)[0]).toMatchObject({ title: 't1', completedAt: 12345 })
    d = applyTxn(d, ops, 'undo').data
    expect(names(d)).toEqual(['t1', 't2', 't3', 't4']); expect(Object.keys(d.completed)).toHaveLength(0)
  })
  it('hidden tasks skip one block; fewer tasks than the limit shows only those; empty is empty', () => {
    const d = build(['a', 'b']); const s = sortTasks(Object.values(d.tasks))
    expect(focusTasks(s, [], 3)).toHaveLength(2); expect(focusTasks(s, [s[0].id], 3).map((t) => t.title)).toEqual(['b']); expect(focusTasks([], [], 3)).toEqual([])
  })
  it('restores completed tasks to the top, reversibly', () => {
    let d = build(['a', 'b']); const s = sortTasks(Object.values(d.tasks))
    d = run(d, completeOps(s[1], 1))
    const restore = restoreOps(Object.values(d.completed)[0], sortTasks(Object.values(d.tasks)))
    d = run(d, restore); expect(names(d)).toEqual(['b', 'a']); expect(Object.keys(d.completed)).toHaveLength(0)
  })
})

describe('notifications', () => {
  const date = '2026-10-22'
  const a = act({ date, title: 'Study', startMin: 600, endMin: 660 })
  const events = buildEvents(date, occurrencesOn([a], date))
  it('builds hourly, start and end events with stable keys', () => {
    expect(events.filter((e) => e.kind === 'hourly')).toHaveLength(24)
    expect(events.find((e) => e.kind === 'start')?.at).toBe(atMs(date, 600)); expect(events.find((e) => e.kind === 'end')?.at).toBe(atMs(date, 660))
  })
  it('fires each event once, never replays after being recorded', () => {
    const fired = new Set<string>(); const now = atMs(date, 600) + 5000
    const first = selectDue(events, now, fired); expect(first.play.map((e) => e.kind).sort()).toEqual(['hourly', 'start'])
    first.mark.forEach((k) => fired.add(k))
    expect(selectDue(events, now + 20_000, fired).play).toHaveLength(0)
    expect(selectDue(events, now + 20_000, new Set(fired)).mark).toHaveLength(0)
  })
  it('after sleep, missed events are marked but not played', () => {
    const woke = atMs(date, 14 * 60) + 10_000
    const r = selectDue(events, woke, new Set())
    expect(r.play.map((e) => e.kind)).toEqual(['hourly']) // only the 14:00 chime, within 90 s
    expect(r.mark.length).toBeGreaterThan(r.play.length)
  })
  it('plays at most one sound per kind when events overlap', () => {
    const b = act({ date, title: 'Other', startMin: 600, endMin: 660 })
    const ev = buildEvents(date, occurrencesOn([a, b], date))
    const { play } = selectDue(ev, atMs(date, 600) + 1000, new Set())
    expect(coalesce(play).map((e) => e.kind)).toEqual(['hourly', 'start'])
  })
  it('the three sounds are different', () => {
    const j = (k: Parameters<typeof soundRecipe>[0]) => JSON.stringify(soundRecipe(k))
    expect(new Set([j('hourly'), j('start'), j('end')]).size).toBe(3)
  })
  it('builds unique future alarms, respects sound toggles, and caps the queue', () => {
    const now = new Date(2026, 9, 22, 8).getTime()
    const activities = Array.from({ length: 5 }, (_, i) => {
      const startMin = 540 + i * 30
      return act({
        date: '2026-10-22',
        title: `Recurring ${i}`,
        startMin,
        endMin: startMin + 30,
        recurrence: { freq: 'daily', weekdays: [] },
      })
    })
    const data: Data = { ...emptyData(), activities: Object.fromEntries(activities.map((activity) => [activity.id, activity])) }
    const settings = { ...DEFAULT_SETTINGS, systemNotifications: true }
    const queue = buildNativeSchedule(data, settings, now)
    expect(queue.notifications).toHaveLength(450)
    expect(queue.truncated).toBeGreaterThan(0)
    expect(new Set(queue.notifications.map(({ id }) => id)).size).toBe(queue.notifications.length)
    expect(queue.notifications.every(({ schedule }) => schedule?.at && schedule.at.getTime() > now)).toBe(true)
    expect(queue.notifications.every(({ schedule }) => schedule?.allowWhileIdle)).toBe(true)
    expect(queue.notifications.every(({ channelId, sound }) =>
      channelId === 'daybloom-v2-hourly' ? sound === 'hourly.wav'
        : channelId === 'daybloom-v2-start' ? sound === 'start.wav'
          : channelId === 'daybloom-v2-end' && sound === 'end.wav',
    )).toBe(true)

    const hourlyOff = { ...settings, hourly: { ...settings.hourly, on: false } }
    const filtered = buildNativeSchedule(data, hourlyOff, now)
    expect(filtered.notifications.every(({ channelId }) => channelId !== 'daybloom-v2-hourly')).toBe(true)
  })
})

describe('backup import validation', () => {
  it('round-trips and rejects bad input', () => {
    const a = act({ date: '2026-10-22' }); const data: Data = { ...emptyData(), activities: { [a.id]: a } }
    const text = JSON.stringify(makeBackup(data, DEFAULT_SETTINGS))
    const r = parseBackup(text); expect(r.ok).toBe(true)
    expect(parseBackup('nope').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'other' })).ok).toBe(false)
    expect(parseBackup(JSON.stringify({ ...JSON.parse(text), data: { activities: { x: { id: 'x' } }, tasks: {}, completed: {} } })).ok).toBe(false)
  })
})

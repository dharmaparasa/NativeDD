import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Copy, History as HistoryIcon, MoreHorizontal, Pencil, Plus, Redo2, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useStore, store } from '../lib/store'
import { cmd } from '../lib/commands'
import { useNow, isTyping } from '../hooks'
import type { Occurrence } from '../lib/types'
import { occurrencesOn } from '../lib/recurrence'
import { draftFor } from '../lib/activities'
import { addDays, fmtHourLabel, fmtMonthDay, fmtTime, fmtWeekday, minutesOfDay, todayStr } from '../lib/time'
import { DAY_H, HOUR_H, PX_PER_MIN, layoutOverlaps, minutesToY, progressOf, yToMinutes } from '../lib/timeline'
import { DoubleTap, isTap, swipeDirection } from '../lib/gestures'
import { focusTasks, sortTasks } from '../lib/priority'
import { haptic } from '../lib/sound'
import ActivityCard, { GUTTER } from './ActivityCard'
import ActivitySheet, { type Draft } from './ActivitySheet'
import BulkSheet, { type BulkCfg } from './BulkSheet'
import DetailsSheet from './DetailsSheet'
import { PopMenu, ScopeDialog, type MenuItem } from './ui'

type SheetState = { t: 'create'; date: string; startMin?: number } | { t: 'edit'; occ: Occurrence }
const IDLE_MS = 8000

export default function DayView() {
  const st = useStore()
  const now = useNow(10_000)
  const today = todayStr(now)
  const nowMin = minutesOfDay(now)
  const [date, setDate] = useState(today)
  const [dir, setDir] = useState<'l' | 'r'>('l')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [details, setDetails] = useState<Occurrence | null>(null)
  const [menu, setMenu] = useState<{ occ?: Occurrence; x: number; y: number } | null>(null)
  const [scope, setScope] = useState<Occurrence | null>(null)
  const [bulk, setBulk] = useState<BulkCfg | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dbl = useRef(new DoubleTap())
  const down = useRef({ x: 0, y: 0 })
  const swipe = useRef({ x: 0, y: 0, t: 0 })

  const acts = useMemo(() => Object.values(st.data.activities), [st.data.activities])
  const sorted = useMemo(() => sortTasks(Object.values(st.data.tasks)), [st.data.tasks])
  const occs = useMemo(() => occurrencesOn(acts, date), [acts, date])
  const occsOn = useCallback((d: string) => occurrencesOn(acts, d), [acts])
  const limit = st.settings.focusCount
  const isToday = date === today
  const overlayOpen = !!(sheet || details || menu || scope || bulk)

  const placed = useMemo(() => {
    const info = occs.map((o) => {
      const tasks = o.kind === 'focus' ? focusTasks(sorted, st.data.activities[o.activityId]?.hiddenTasks[date], limit) : null
      const minPx = tasks ? 20 + 22 + Math.max(1, tasks.length) * 24 : 34
      const px = Math.max((o.endMin - o.startMin) * PX_PER_MIN, minPx)
      return { o, tasks, px }
    })
    const layout = layoutOverlaps(info.map(({ o, px }) => ({ id: o.key, startMin: o.startMin, endMin: o.endMin, minMin: px / PX_PER_MIN })))
    return info.map((i) => ({ ...i, ...layout.get(i.o.key)! }))
  }, [occs, sorted, limit, date, st.data.activities])

  // ---- scrolling to "now"
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nowY = () => (innerRef.current?.offsetTop ?? 0) + minutesToY(minutesOfDay())
  const centerNow = useCallback((smooth: boolean) => {
    const el = scrollRef.current; if (!el) return
    el.scrollTo({ top: Math.max(0, nowY() - el.clientHeight / 2), behavior: smooth && !reduced() ? 'smooth' : 'auto' })
  }, [])
  useEffect(() => { requestAnimationFrame(() => centerNow(false)) }, [centerNow])

  const goTo = useCallback((d: string, smoothCenter = false) => {
    setDir(d >= date ? 'l' : 'r'); setDate(d)
    if (smoothCenter) requestAnimationFrame(() => centerNow(true))
  }, [date, centerNow])
  const goToday = () => goTo(todayStr(), true)

  // ---- after 8 s idle: drift back to today / the present (never while editing)
  const live = useRef({ date, overlayOpen })
  live.current = { date, overlayOpen }
  const goRef = useRef(goTo); goRef.current = goTo
  useEffect(() => {
    let timer = 0
    const check = () => {
      if (!live.current.overlayOpen && !isTyping()) {
        const el = scrollRef.current, t = todayStr()
        if (live.current.date !== t) goRef.current(t, true)
        else if (el) { const y = nowY(); if (y < el.scrollTop + 8 || y > el.scrollTop + el.clientHeight - 8) centerNow(true) }
      }
      timer = window.setTimeout(check, IDLE_MS)
    }
    const reset = () => { clearTimeout(timer); timer = window.setTimeout(check, IDLE_MS) }
    const evs = ['pointerdown', 'wheel', 'touchstart', 'touchmove', 'keydown'] as const
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, reset)) }
  }, [centerNow])

  // ---- keyboard: ← → change day, ⌘/Ctrl+Z undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || live.current.overlayOpen) return
      if (e.key === 'ArrowLeft') goRef.current(addDays(live.current.date, -1))
      else if (e.key === 'ArrowRight') goRef.current(addDays(live.current.date, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- gestures
  const onTimelineUp = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-card],button')) return
    if (!isTap(e.clientX - down.current.x, e.clientY - down.current.y)) { dbl.current.reset(); return }
    if (dbl.current.register(e.clientX, e.clientY, Date.now())) {
      const top = innerRef.current!.getBoundingClientRect().top
      haptic(st.settings.haptics, 12)
      setSheet({ t: 'create', date, startMin: yToMinutes(e.clientY - top) })
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0]; if (!t || overlayOpen) return
    const d = swipeDirection(t.clientX - swipe.current.x, t.clientY - swipe.current.y, Date.now() - swipe.current.t)
    if (d) goTo(addDays(date, d === 'next' ? 1 : -1))
  }

  // ---- actions
  const openMenu = useCallback((occ: Occurrence, x: number, y: number) => setMenu({ occ, x, y }), [])
  const openDetails = useCallback((o: Occurrence) => setDetails(o), [])
  const complete = useCallback((t: Parameters<typeof cmd.completeTask>[0]) => cmd.completeTask(t), [])
  const del = (o: Occurrence) => { setDetails(null); if (o.recurring) setScope(o); else cmd.deleteActivity(o, 'all') }
  const dup = (o: Occurrence) => { setDetails(null); setBulk({ title: 'Duplicate', sources: [o], from: addDays(o.date, 1), to: addDays(o.date, 7), today }) }
  const edit = (o: Occurrence) => { setDetails(null); setSheet({ t: 'edit', occ: o }) }
  const cardItems = (o: Occurrence): MenuItem[] => [
    { label: 'Edit', icon: <Pencil size={17} />, onClick: () => edit(o) },
    { label: 'Duplicate', icon: <Copy size={17} />, onClick: () => dup(o) },
    { label: 'Delete', icon: <Trash2 size={17} />, onClick: () => del(o), danger: true },
  ]
  const moreItems: MenuItem[] = [
    { label: 'Reuse yesterday’s schedule', icon: <HistoryIcon size={17} />, onClick: () => setBulk({ title: 'Reuse yesterday', sources: occsOn(addDays(date, -1)), from: date, to: date, today }) },
    { label: 'Copy this day to other dates', icon: <CalendarClock size={17} />, onClick: () => setBulk({ title: 'Copy this day', sources: occs, from: addDays(date, 1), to: addDays(date, 7), today }) },
  ]

  const sheetInitial = (): { draft: Draft; occ?: Occurrence } => {
    if (sheet?.t === 'edit') {
      const a = st.data.activities[sheet.occ.activityId], o = sheet.occ
      return { occ: o, draft: { title: o.title, startMin: o.startMin, endMin: o.endMin, date: o.date, recurrence: { freq: a.recurrence.freq, weekdays: a.recurrence.weekdays }, color: o.color, kind: o.kind } }
    }
    const s = sheet as Extract<SheetState, { t: 'create' }>
    return { draft: draftFor({ date: s.date, startMin: s.startMin, now }) }
  }
  const saveSheet = (d: Draft, sc: 'this' | 'future' | 'all') => {
    if (sheet?.t === 'edit') cmd.editActivity(sheet.occ, sc, { ...d, color: d.color ?? sheet.occ.color })
    else cmd.createActivity(d)
    setSheet(null)
  }

  const current = isToday ? occs.find((o) => o.startMin <= nowMin && nowMin < o.endMin) : undefined
  const next = isToday ? occs.find((o) => o.startMin > nowMin) : undefined
  const yesterdayHas = occsOn(addDays(date, -1)).length > 0

  return (
    <div className="flex h-full flex-col">
      <header className="px-3 pb-1 pt-[calc(0.5rem+var(--safe-t))]">
        <div className="flex items-center gap-0.5">
          <button className="icon-btn" aria-label="Previous day" onClick={() => goTo(addDays(date, -1))}><ChevronLeft /></button>
          <label className="relative min-w-0 flex-1 cursor-pointer rounded-2xl px-2 py-0.5 text-center hover:bg-[#FFF1D6]">
            <span className="block truncate text-xl font-black leading-tight">{fmtWeekday(date)}</span>
            <span className="block text-sm font-bold text-ink-soft">{fmtMonthDay(date)}</span>
            <input type="date" aria-label="Choose date" value={date} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* ignore */ } }}
              onChange={(e) => { if (e.target.value) { goTo(e.target.value); e.target.blur() } }} />
          </label>
          <button className="icon-btn" aria-label="Next day" onClick={() => goTo(addDays(date, 1))}><ChevronRight /></button>
          <button className="icon-btn" aria-label="Undo" disabled={!st.canUndo} onClick={() => store.undo()}><Undo2 size={19} /></button>
          <button className="icon-btn" aria-label="Redo" disabled={!st.canRedo} onClick={() => store.redo()}><Redo2 size={19} /></button>
          <button className="icon-btn" aria-label="More day options" aria-haspopup="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 4 }) }}><MoreHorizontal /></button>
        </div>
        <div className="flex min-h-9 items-center gap-2 px-2 pt-1 text-sm">
          {isToday ? (
            <>
              <span className="text-base font-black tabular-nums">{fmtTime(nowMin)}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-ink-soft" aria-live="polite">
                {current ? <>Now · <span className="text-ink">{current.title}</span> until {fmtTime(current.endMin)}</> : next ? <>Next · <span className="text-ink">{next.title}</span> at {fmtTime(next.startMin)}</> : 'Nothing else scheduled'}
                {current && next && <span className="hidden sm:inline"> · Next {next.title} at {fmtTime(next.startMin)}</span>}
              </span>
            </>
          ) : (
            <>
              <span className="flex-1 font-bold text-ink-soft">{date < today ? 'Earlier' : 'Coming up'}</span>
              <button className="btn-soft px-3 py-1 text-sm" onClick={goToday}>Today</button>
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="hide-scroll relative flex-1 overflow-y-auto" style={{ touchAction: 'manipulation' }}
        onTouchStart={(e) => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() } }} onTouchEnd={onTouchEnd}>
        <div key={date} ref={innerRef} className={`no-select relative mx-auto max-w-3xl ${dir === 'l' ? 'anim-slide-l' : 'anim-slide-r'}`}
          style={{ height: DAY_H, marginTop: 8, marginBottom: 150 }}
          onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }} onPointerUp={onTimelineUp}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: h * HOUR_H }}>
              <span className="absolute -top-2.5 left-1 w-[44px] text-right text-[11px] font-bold text-ink-faint">{h === 0 ? '' : fmtHourLabel(h)}</span>
              <div className="absolute border-t border-dashed border-line/70" style={{ left: GUTTER, right: 0, top: HOUR_H / 2 }} />
            </div>
          ))}
          {placed.map(({ o, tasks, px, col, cols }) => (
            <ActivityCard key={o.key} occ={o} top={minutesToY(o.startMin)} height={px} col={col} cols={cols}
              past={isToday && o.endMin <= nowMin} progress={isToday ? progressOf(nowMin, o.startMin, o.endMin) : null}
              tasks={tasks} haptics={st.settings.haptics} timeFmt={st.settings.timeFormat}
              onOpen={openDetails} onMenu={openMenu} onComplete={complete} />
          ))}
          {isToday && (
            <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: minutesToY(nowMin) - 1 }} aria-hidden>
              <span className="ml-[46px] h-2.5 w-2.5 rounded-full bg-coral shadow" />
              <span className="h-[2px] flex-1 bg-coral/70" />
            </div>
          )}
          {occs.length === 0 && (
            <div className="absolute inset-x-6 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[#F7E48E] bg-[#FFFBE6]/90 p-5 text-center" style={{ top: minutesToY(8 * 60) + 10, left: GUTTER }}>
              <Sparkles className="text-[#E8B923]" />
              <p className="font-extrabold">A fresh, open day</p>
              <p className="text-sm font-semibold text-ink-soft">Double-tap the timeline to add something.</p>
              {yesterdayHas && <button className="btn-soft mt-1 px-3 py-1.5 text-sm" onClick={() => setBulk({ title: 'Reuse yesterday', sources: occsOn(addDays(date, -1)), from: date, to: date, today })}>Reuse yesterday’s schedule</button>}
            </div>
          )}
        </div>
      </div>

      <button aria-label="Add activity" onClick={() => setSheet({ t: 'create', date })}
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sun text-ink shadow-soft transition hover:bg-sun-deep active:scale-90 bottom-[calc(5.2rem+var(--safe-b))] md:bottom-8 md:right-8">
        <Plus size={28} strokeWidth={2.8} />
      </button>

      {sheet && (() => { const { draft, occ } = sheetInitial(); return <ActivitySheet key={occ?.key ?? 'new'} mode={sheet.t} occ={occ} initial={draft} occsOn={occsOn} onSave={saveSheet} onClose={() => setSheet(null)} /> })()}
      {details && (
        <DetailsSheet occ={details} act={st.data.activities[details.activityId]} sorted={sorted} limit={limit} day={occsOn(details.date)}
          onClose={() => setDetails(null)} onEdit={() => edit(details)} onDuplicate={() => dup(details)} onDelete={() => del(details)}
          onComplete={complete} onHide={(ids) => cmd.setHidden(details, ids)} />
      )}
      {menu && <PopMenu x={menu.x} y={menu.y} label={menu.occ ? `Actions for ${menu.occ.title}` : 'Day options'} items={menu.occ ? cardItems(menu.occ) : moreItems} onClose={() => setMenu(null)} />}
      {scope && <ScopeDialog verb="Delete" onClose={() => setScope(null)} onPick={(s) => { cmd.deleteActivity(scope, s); setScope(null) }} />}
      {bulk && <BulkSheet cfg={bulk} onClose={() => setBulk(null)} />}
    </div>
  )
}

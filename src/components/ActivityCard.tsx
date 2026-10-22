import { memo, useRef } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'
import type { Occurrence, Task } from '../lib/types'
import { COLORS } from '../lib/colors'
import { fmtTime } from '../lib/time'
import { haptic } from '../lib/sound'

export const GUTTER = 54
interface Props {
  occ: Occurrence; top: number; height: number; col: number; cols: number
  past: boolean; progress: number | null; tasks: Task[] | null; haptics: boolean; timeFmt: string
  onOpen: (o: Occurrence) => void
  onMenu: (o: Occurrence, x: number, y: number) => void
  onComplete: (t: Task) => void
}

function ActivityCard({ occ, top, height, col, cols, past, progress, tasks, haptics, onOpen, onMenu, onComplete }: Props) {
  const c = COLORS[occ.color]
  const timer = useRef<number | undefined>(undefined)
  const long = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const clear = () => { clearTimeout(timer.current); timer.current = undefined }
  const compact = height < 58 && !tasks
  const range = `${fmtTime(occ.startMin)} – ${fmtTime(occ.endMin)}`
  const w = `calc((100% - ${GUTTER + 6}px) / ${cols})`

  return (
    <div data-card role="button" tabIndex={0} aria-label={`${occ.title}, ${range}`}
      className={`no-select absolute cursor-pointer overflow-hidden rounded-2xl border shadow-card transition active:scale-[.985] ${past ? 'opacity-70' : ''}`}
      style={{ top, height: height - 3, left: `calc(${GUTTER}px + ${w} * ${col})`, width: `calc(${w} - 4px)`, background: c.bg, borderColor: c.border, borderLeft: `5px solid ${c.accent}` }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        long.current = false; origin.current = { x: e.clientX, y: e.clientY }
        const { clientX: x, clientY: y } = e
        timer.current = window.setTimeout(() => { long.current = true; haptic(haptics, 15); onMenu(occ, x, y) }, 480)
      }}
      onPointerMove={(e) => { if (timer.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8) clear() }}
      onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear}
      onContextMenu={(e) => { e.preventDefault(); clear(); const r = e.currentTarget.getBoundingClientRect(); const kb = e.clientX === 0 && e.clientY === 0; onMenu(occ, kb ? r.left + 20 : e.clientX, kb ? r.top + 20 : e.clientY) }}
      onClick={() => { if (long.current) { long.current = false; return } onOpen(occ) }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(occ) } }}>
      <div className={`flex gap-1 px-2.5 ${compact ? 'items-center py-0' : 'items-start pt-1.5'}`} style={{ height: compact ? '100%' : undefined }}>
        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="truncate text-[15px] font-extrabold leading-tight">{occ.title} <span className="text-xs font-semibold text-ink-soft">· {range}</span></div>
          ) : (
            <>
              <div className="truncate text-[15px] font-extrabold leading-tight">{occ.title}</div>
              <div className="text-xs font-semibold text-ink-soft">{range}</div>
            </>
          )}
        </div>
        <button aria-label={`Actions for ${occ.title}`} aria-haspopup="menu"
          className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-white/70"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); onMenu(occ, r.left - 150, r.bottom) }}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      {tasks && (
        <ul className="px-2.5 pb-1" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {tasks.length === 0 && <li className="py-1 text-sm font-semibold text-ink-soft">All clear for now</li>}
          {tasks.map((t) => (
            <li key={t.id} className="flex h-6 items-center gap-2">
              <button aria-label={`Mark “${t.title}” done`} onClick={() => { haptic(haptics); onComplete(t) }}
                className="group -m-1.5 flex h-8 w-8 shrink-0 items-center justify-center">
                <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full border-2 bg-white transition group-hover:bg-[#E2F7EC] group-active:scale-90" style={{ borderColor: c.accent }}>
                  <Check size={13} strokeWidth={3.5} className="text-[#2E9E6E] opacity-0 transition group-hover:opacity-60" />
                </span>
              </button>
              <span className="truncate text-sm font-bold">{t.title}</span>
            </li>
          ))}
        </ul>
      )}
      {progress !== null && (
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/60" role="progressbar" aria-label="Progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-r-full transition-all duration-1000" style={{ width: `${progress * 100}%`, background: c.accent }} />
        </div>
      )}
    </div>
  )
}
export default memo(ActivityCard)

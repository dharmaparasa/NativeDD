import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, CornerDownRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { cmd } from '../lib/commands'
import { sortTasks, type InsertMode } from '../lib/priority'
import type { Task } from '../lib/types'
import { haptic } from '../lib/sound'

const TINT = ['#FFF1BF', '#FFF6D6', '#FFFAE9']
type Mode = InsertMode | { after: string }
const NEXT: Record<InsertMode, InsertMode> = { middle: 'top', top: 'bottom', bottom: 'middle' }

export default function Inbox() {
  const st = useStore()
  const tasks = useMemo(() => sortTasks(Object.values(st.data.tasks)), [st.data.tasks])
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('middle')
  const [open, setOpen] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; dy: number; to: number; from: number } | null>(null)
  const rows = useRef(new Map<string, HTMLElement>())
  const startY = useRef(0)

  const add = () => { cmd.addTask(text, mode); setText(''); if (typeof mode !== 'string') setMode('middle') }
  const afterTask = typeof mode === 'string' ? undefined : tasks.find((t) => t.id === mode.after)
  const modeLabel = typeof mode === 'string' ? { top: 'Top', middle: 'Middle', bottom: 'Bottom' }[mode] : `Below “${afterTask?.title ?? ''}”`

  const targetIndex = (id: string, y: number) =>
    tasks.filter((t) => t.id !== id).filter((t) => { const r = rows.current.get(t.id)?.getBoundingClientRect(); return r ? r.top + r.height / 2 < y : false }).length

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="px-5 pb-2 pt-[calc(1rem+var(--safe-t))]">
        <h1 className="text-2xl font-black">Priority Inbox</h1>
        <p className="text-sm font-semibold text-ink-soft">{tasks.length === 0 ? 'Nothing waiting. Enjoy the calm.' : `${tasks.length} to do · the order is the priority`}</p>
      </header>
      <form className="flex items-center gap-2 px-4 pb-3" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task and press Enter" aria-label="New task" maxLength={140} />
        <button type="button" className="btn-soft max-w-[130px] px-3 py-2 text-sm" aria-label={`Add position: ${modeLabel}. Change.`}
          onClick={() => setMode(typeof mode === 'string' ? NEXT[mode] : 'middle')}><span className="truncate">{modeLabel}</span></button>
        <button type="submit" className="btn-primary !rounded-full !p-3" aria-label="Add task"><Plus size={22} strokeWidth={3} /></button>
      </form>

      <ul className="hide-scroll flex-1 space-y-2 overflow-y-auto px-4 pb-32">
        {tasks.length === 0 && <li className="mt-10 text-center text-ink-soft">Type above to add your first task.</li>}
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i} count={tasks.length} tint={TINT[i]} open={open === t.id}
            dragging={drag?.id === t.id ? drag : null}
            marker={drag && drag.to !== drag.from && drag.to === i ? (drag.to < drag.from ? 'above' : 'below') : null}
            refCb={(el) => { if (el) rows.current.set(t.id, el); else rows.current.delete(t.id) }}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
            onHandleDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startY.current = e.clientY; setDrag({ id: t.id, dy: 0, to: i, from: i }) }}
            onHandleMove={(e) => { if (drag?.id === t.id) setDrag({ ...drag, dy: e.clientY - startY.current, to: targetIndex(t.id, e.clientY) }) }}
            onHandleUp={() => { if (drag && drag.to !== drag.from) { haptic(st.settings.haptics); cmd.moveTask(t.id, drag.to) } setDrag(null) }}
            onUp={() => cmd.moveTask(t.id, i - 1)} onDown={() => cmd.moveTask(t.id, i + 1)}
            onBelow={() => { setMode({ after: t.id }); setOpen(null) }} />
        ))}
      </ul>
    </div>
  )
}

interface RowProps {
  task: Task; index: number; count: number; tint?: string; open: boolean
  dragging: { dy: number } | null; marker: 'above' | 'below' | null
  refCb: (el: HTMLElement | null) => void
  onToggle: () => void; onUp: () => void; onDown: () => void; onBelow: () => void
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleMove: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleUp: () => void
}
function TaskRow({ task, index, count, tint, open, dragging, marker, refCb, onToggle, onUp, onDown, onBelow, onHandleDown, onHandleMove, onHandleUp }: RowProps) {
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note ?? '')
  const st = useStore()
  return (
    <li ref={refCb} className={`relative rounded-2xl border border-line shadow-card transition-shadow ${dragging ? 'z-20 shadow-soft' : ''}`}
      style={{ background: tint ?? '#fff', transform: dragging ? `translateY(${dragging.dy}px)` : undefined, borderLeft: index === 0 ? '5px solid #FFC233' : undefined }}>
      {marker && <span className={`pointer-events-none absolute inset-x-2 h-1 rounded-full bg-[#4AA8E8] ${marker === 'above' ? '-top-[7px]' : '-bottom-[7px]'}`} />}
      <div className="flex items-center gap-1 pr-1.5">
        <button className="touch-none flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-ink-faint active:cursor-grabbing" aria-label={`Drag to reorder “${task.title}”`}
          onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}><GripVertical size={18} /></button>
        <button aria-label={`Mark “${task.title}” done`} onClick={() => { haptic(st.settings.haptics); cmd.completeTask(task) }} className="group -ml-1 flex h-11 w-9 shrink-0 items-center justify-center">
          <span className="h-6 w-6 rounded-full border-2 border-[#3FBF88] bg-white transition group-hover:bg-[#E2F7EC] group-active:scale-90" />
        </button>
        <button className={`min-w-0 flex-1 py-3 text-left ${index === 0 ? 'text-[17px] font-black' : 'font-bold'}`} aria-expanded={open} onClick={onToggle}>
          <span className="block truncate">{task.title}</span>
          {task.note && !open && <span className="block truncate text-xs font-semibold text-ink-soft">{task.note}</span>}
        </button>
      </div>
      {open && (
        <div className="anim-fade space-y-2 border-t border-line/70 px-3 pb-3 pt-2">
          <input className="field py-2" aria-label="Task name" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== task.title && cmd.editTask(task, { title })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          <textarea className="field py-2 text-sm" rows={2} aria-label="Note" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (task.note ?? '') && cmd.editTask(task, { note })} />
          <div className="flex flex-wrap gap-1.5">
            <button className="btn-soft px-3 py-1.5 text-sm" disabled={index === 0} onClick={onUp}><ArrowUp size={16} />Up</button>
            <button className="btn-soft px-3 py-1.5 text-sm" disabled={index === count - 1} onClick={onDown}><ArrowDown size={16} />Down</button>
            <button className="btn-soft px-3 py-1.5 text-sm" onClick={onBelow}><CornerDownRight size={16} />Add below</button>
            <button className="btn-soft px-3 py-1.5 text-sm text-[#C23B35]" onClick={() => cmd.deleteTask(task)}><Trash2 size={16} />Delete</button>
          </div>
        </div>
      )}
    </li>
  )
}

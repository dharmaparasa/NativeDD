import { AlertTriangle, Copy, EyeOff, Pencil, Repeat, Trash2 } from 'lucide-react'
import { Sheet } from './ui'
import type { Activity, Occurrence, Task } from '../lib/types'
import { COLORS } from '../lib/colors'
import { describeRecurrence } from '../lib/recurrence'
import { conflictsWith } from '../lib/activities'
import { fmtFull, fmtTime } from '../lib/time'
import { focusTasks } from '../lib/priority'

interface Props {
  occ: Occurrence; act?: Activity; sorted: Task[]; limit: number; day: Occurrence[]
  onClose: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void
  onComplete: (t: Task) => void; onHide: (ids: string[]) => void
}
export default function DetailsSheet({ occ, act, sorted, limit, day, onClose, onEdit, onDuplicate, onDelete, onComplete, onHide }: Props) {
  const c = COLORS[occ.color]
  const hidden = act?.hiddenTasks[occ.date] ?? []
  const shown = occ.kind === 'focus' ? focusTasks(sorted, hidden, limit) : []
  const conflicts = conflictsWith(day, occ.startMin, occ.endMin, occ.key)
  const mins = occ.endMin - occ.startMin
  return (
    <Sheet title={occ.title} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-3">
        <div className="rounded-2xl border p-3" style={{ background: c.bg, borderColor: c.border }}>
          <div className="text-lg font-extrabold">{fmtTime(occ.startMin)} – {fmtTime(occ.endMin)}</div>
          <div className="text-sm font-semibold text-ink-soft">{fmtFull(occ.date)} · {mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`}</div>
          {act && <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><Repeat size={14} />{describeRecurrence(act.recurrence, act.date)}</div>}
        </div>
        {conflicts.length > 0 && (
          <div role="status" className="flex items-start gap-2 rounded-2xl bg-[#FFF1D6] px-3 py-2 text-sm font-semibold"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#C98A00]" />Overlaps with {conflicts.map((o) => o.title).join(', ')}</div>
        )}
        {occ.kind === 'focus' && (
          <div>
            <div className="mb-1 text-sm font-extrabold text-ink-soft">Up next from your Inbox</div>
            {shown.length === 0 && <p className="text-sm font-semibold text-ink-soft">All clear for now</p>}
            <ul className="space-y-1.5">
              {shown.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2">
                  <button aria-label={`Mark “${t.title}” done`} onClick={() => onComplete(t)} className="h-6 w-6 shrink-0 rounded-full border-2" style={{ borderColor: c.accent }} />
                  <span className="min-w-0 flex-1 truncate font-bold">{t.title}</span>
                  <button className="icon-btn !h-8 !w-8" aria-label={`Hide “${t.title}” from this block`} title="Hide from this block" onClick={() => onHide([...hidden, t.id])}><EyeOff size={16} /></button>
                </li>
              ))}
            </ul>
            {hidden.length > 0 && <button className="btn-ghost mt-1 px-2 py-1 text-sm" onClick={() => onHide([])}>Show {hidden.length} hidden again</button>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-soft flex-col gap-1 py-3 text-sm" onClick={onEdit}><Pencil size={18} />Edit</button>
          <button className="btn-soft flex-col gap-1 py-3 text-sm" onClick={onDuplicate}><Copy size={18} />Duplicate</button>
          <button className="btn-soft flex-col gap-1 py-3 text-sm text-[#C23B35]" onClick={onDelete}><Trash2 size={18} />Delete</button>
        </div>
      </div>
    </Sheet>
  )
}

import type { CompletedTask, Op, Task } from './types'
import { uid } from './types'

export const sortTasks = (tasks: Task[]) => [...tasks].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
export type InsertMode = 'top' | 'middle' | 'bottom'

/** Index for a new task: top=0, bottom=n, middle=around the centre. */
export const insertIndexFor = (n: number, mode: InsertMode) => (mode === 'top' ? 0 : mode === 'bottom' ? n : Math.ceil(n / 2))

/** Order value that places an item at `index` among `list` (the list without that item). */
export function orderForIndex(list: Task[], index: number): number {
  const prev = list[index - 1]?.order, next = list[index]?.order
  if (prev === undefined && next === undefined) return 1024
  if (prev === undefined) return next! - 1024
  if (next === undefined) return prev + 1024
  return (prev + next) / 2
}
const tooTight = (list: Task[], index: number, v: number) => {
  const prev = list[index - 1]?.order, next = list[index]?.order
  return (prev !== undefined && v - prev < 1e-6) || (next !== undefined && next - v < 1e-6)
}

export function addTaskOps(sorted: Task[], title: string, index: number, now = Date.now()): { ops: Op[]; task: Task } {
  const i = Math.max(0, Math.min(sorted.length, index))
  let order = orderForIndex(sorted, i)
  const ops: Op[] = []
  let list = sorted
  if (tooTight(sorted, i, order)) { // very rare: renumber everything
    list = sorted.map((t, k) => ({ ...t, order: (k < i ? k : k + 1) * 1024 }))
    list.forEach((t, k) => ops.push({ table: 'tasks', id: t.id, before: sorted[k], after: t }))
    order = i * 1024
  }
  const task: Task = { id: uid(), title: title.trim() || 'New task', order, createdAt: now }
  ops.push({ table: 'tasks', id: task.id, after: task })
  return { ops, task }
}

/** Move a task so it ends up at `toIndex` in the final list. Usually a single-record change. */
export function reorderOps(sorted: Task[], id: string, toIndex: number): Op[] {
  const from = sorted.findIndex((t) => t.id === id)
  if (from < 0) return []
  const to = Math.max(0, Math.min(sorted.length - 1, toIndex))
  if (from === to) return []
  const rest = sorted.filter((t) => t.id !== id)
  const order = orderForIndex(rest, to)
  if (!tooTight(rest, to, order)) return [{ table: 'tasks', id, before: sorted[from], after: { ...sorted[from], order } }]
  const final = [...rest]; final.splice(to, 0, sorted[from])
  const ops: Op[] = []
  final.forEach((t, k) => { const before = sorted.find((s) => s.id === t.id)!; const after = { ...t, order: (k + 1) * 1024 }; if (before.order !== after.order) ops.push({ table: 'tasks', id: t.id, before, after }) })
  return ops
}

export const completeOps = (task: Task, now = Date.now()): Op[] => [
  { table: 'tasks', id: task.id, before: task },
  { table: 'completed', id: task.id, after: { ...task, completedAt: now } as CompletedTask },
]
export function restoreOps(done: CompletedTask, sorted: Task[]): Op[] {
  const { completedAt: _c, ...task } = done
  void _c
  const restored: Task = { ...task, order: orderForIndex(sorted, 0) } // back at the top
  return [{ table: 'completed', id: done.id, before: done }, { table: 'tasks', id: done.id, after: restored }]
}

/** The tasks a Focus Block shows: the top `limit` unfinished, minus ones hidden from it. */
export const focusTasks = (sorted: Task[], hidden: string[] = [], limit = 3) =>
  sorted.filter((t) => !hidden.includes(t.id)).slice(0, limit)

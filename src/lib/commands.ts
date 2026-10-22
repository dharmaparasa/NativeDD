import { store } from './store'
import type { Activity, Occurrence, Task } from './types'
import { uid } from './types'
import { sortTasks, addTaskOps, completeOps, restoreOps, reorderOps, insertIndexFor, type InsertMode } from './priority'
import { bulkOps, deleteOps, editOps, createOps, makeActivity, planBulkCopy, setHiddenOps, type EditPatch, type Scope } from './activities'

const tasksSorted = () => sortTasks(Object.values(store.getState().data.tasks))
const act = (id: string) => store.getState().data.activities[id]
const q = (s: string) => `“${s}”`

export const cmd = {
  createActivity(p: Parameters<typeof makeActivity>[0]) {
    const a = makeActivity(p); store.commit(`Added ${q(a.title)}`, createOps(a), `Added ${q(a.title)}`); return a
  },
  editActivity(occ: Occurrence, scope: Scope, patch: EditPatch) {
    const a = act(occ.activityId); if (!a) return
    store.commit(`Edited ${q(patch.title.trim() || occ.title)}`, editOps(a, occ.date, scope, patch), 'Saved changes')
  },
  deleteActivity(occ: Occurrence, scope: Scope) {
    const a = act(occ.activityId); if (!a) return
    store.commit(`Deleted ${q(occ.title)}`, deleteOps(a, occ.date, scope), scope === 'all' && occ.recurring ? `Deleted series ${q(occ.title)}` : `Deleted ${q(occ.title)}`)
  },
  bulkCopy(items: Activity[]) {
    const n = items.length
    store.commit(`Created ${n} ${n === 1 ? 'activity' : 'activities'}`, bulkOps(items), `Created ${n} ${n === 1 ? 'activity' : 'activities'}`)
  },
  planCopy: (sources: Occurrence[], dates: string[]) => planBulkCopy(Object.values(store.getState().data.activities), sources, dates, uid()),
  setHidden(occ: Occurrence, ids: string[]) { const a = act(occ.activityId); if (a) store.commit('Changed Focus Block', setHiddenOps(a, occ.date, ids)) },

  addTask(title: string, mode: InsertMode | { after: string }) {
    const sorted = tasksSorted()
    const index = typeof mode === 'string' ? insertIndexFor(sorted.length, mode) : sorted.findIndex((t) => t.id === mode.after) + 1
    const { ops } = addTaskOps(sorted, title, index)
    store.commit('Added task', ops)
  },
  completeTask(task: Task) { store.commit(`Completed ${q(task.title)}`, completeOps(task), `Done: ${q(task.title)}`) },
  restoreTask(id: string) {
    const done = store.getState().data.completed[id]; if (!done) return
    store.commit(`Restored ${q(done.title)}`, restoreOps(done, tasksSorted()), `Restored ${q(done.title)}`)
  },
  moveTask(id: string, toIndex: number, toast = true) {
    const sorted = tasksSorted(); const ops = reorderOps(sorted, id, toIndex)
    const t = sorted.find((x) => x.id === id)
    if (ops.length) store.commit('Moved task', ops, toast ? `Moved ${q(t?.title ?? 'task')}` : undefined)
  },
  editTask(task: Task, patch: Partial<Pick<Task, 'title' | 'note'>>) {
    const next = { ...task, ...patch, title: (patch.title ?? task.title).trim() || 'New task' }
    store.commit('Edited task', [{ table: 'tasks', id: task.id, before: task, after: next }])
  },
  deleteTask(task: Task) { store.commit(`Deleted ${q(task.title)}`, [{ table: 'tasks', id: task.id, before: task }], `Deleted ${q(task.title)}`) },
}

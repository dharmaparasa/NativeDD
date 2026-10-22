import type { Data, Op, TableName, Txn } from './types'

/** Apply (or reverse) a transaction. Pure: returns new data and which records changed. */
export function applyTxn(data: Data, ops: Op[], dir: 'do' | 'undo'): { data: Data; touched: { table: TableName; id: string }[] } {
  const next: Data = { activities: { ...data.activities }, tasks: { ...data.tasks }, completed: { ...data.completed } }
  const seq = dir === 'do' ? ops : [...ops].reverse()
  for (const op of seq) {
    const value = dir === 'do' ? op.after : op.before
    const table = next[op.table] as Record<string, unknown>
    if (value === undefined) delete table[op.id]
    else table[op.id] = value
  }
  return { data: next, touched: ops.map((o) => ({ table: o.table, id: o.id })) }
}

/** Lightweight action history: each entry stores exact before/after records. */
export class History {
  undoStack: Txn[] = []
  redoStack: Txn[] = []
  constructor(private limit = 200) {}
  push(t: Txn) { this.undoStack.push(t); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = [] }
  popUndo() { const t = this.undoStack.pop(); if (t) this.redoStack.push(t); return t }
  popRedo() { const t = this.redoStack.pop(); if (t) this.undoStack.push(t); return t }
  get canUndo() { return this.undoStack.length > 0 }
  get canRedo() { return this.redoStack.length > 0 }
  clear() { this.undoStack = []; this.redoStack = [] }
}

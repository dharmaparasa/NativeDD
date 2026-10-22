import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { useDatabase, loadAll, saveTouched, replaceAll, wipeAll, saveFired } from '../src/lib/db'
import { applyTxn } from '../src/lib/undo'
import { emptyData, DEFAULT_SETTINGS } from '../src/lib/types'
import { makeActivity, createOps } from '../src/lib/activities'
import { addTaskOps, completeOps } from '../src/lib/priority'

describe('IndexedDB persistence', () => {
  it('persists transactions, undo, settings, fired keys and survives a reload', async () => {
    useDatabase('t1')
    const a = makeActivity({ title: 'Walk', date: '2026-10-22', startMin: 480, endMin: 540 })
    const { ops: tOps, task } = addTaskOps([], 'Pay bill', 0)
    let data = emptyData()
    for (const ops of [createOps(a), tOps, completeOps(task, 99)]) {
      const r = applyTxn(data, ops, 'do'); data = r.data; await saveTouched(data, r.touched)
    }
    await saveFired(['hour:2026-10-22:8'])
    let loaded = await loadAll() // "reload"
    expect(Object.keys(loaded.data.activities)).toEqual([a.id]); expect(Object.keys(loaded.data.tasks)).toHaveLength(0)
    expect(loaded.data.completed[task.id].completedAt).toBe(99); expect(loaded.fired.has('hour:2026-10-22:8')).toBe(true)
    expect(loaded.settings).toEqual(DEFAULT_SETTINGS)
    const undo = applyTxn(data, completeOps(task, 99), 'undo'); await saveTouched(undo.data, undo.touched)
    loaded = await loadAll(); expect(loaded.data.tasks[task.id].title).toBe('Pay bill'); expect(Object.keys(loaded.data.completed)).toHaveLength(0)
  })
  it('replaces and wipes everything', async () => {
    useDatabase('t2')
    const a = makeActivity({ title: 'X', date: '2026-10-22' })
    await replaceAll({ ...emptyData(), activities: { [a.id]: a } }, DEFAULT_SETTINGS)
    expect(Object.keys((await loadAll()).data.activities)).toHaveLength(1)
    await wipeAll(); expect(Object.keys((await loadAll()).data.activities)).toHaveLength(0)
  })
})

import Dexie, { type Table } from 'dexie'
import type { Activity, CompletedTask, Data, Settings, TableName, Task } from './types'
import { DEFAULT_SETTINGS, emptyData } from './types'

interface FiredRow { key: string; at: number }
interface SettingsRow { id: 'main'; value: Settings }

export class PlannerDB extends Dexie {
  activities!: Table<Activity, string>
  tasks!: Table<Task, string>
  completed!: Table<CompletedTask, string>
  fired!: Table<FiredRow, string>
  settings!: Table<SettingsRow, string>
  constructor(name = 'daybloom') {
    super(name)
    this.version(1).stores({ activities: 'id,date', tasks: 'id,order', completed: 'id,completedAt', fired: 'key,at', settings: 'id' })
  }
}
export let db = new PlannerDB()
/** Tests can point the app at a fresh database. */
export const useDatabase = (name: string) => { db = new PlannerDB(name); return db }

export async function loadAll(): Promise<{ data: Data; settings: Settings; fired: Set<string> }> {
  const [a, t, c, s, f] = await Promise.all([db.activities.toArray(), db.tasks.toArray(), db.completed.toArray(), db.settings.get('main'), db.fired.toArray()])
  const data = emptyData()
  a.forEach((x) => (data.activities[x.id] = x)); t.forEach((x) => (data.tasks[x.id] = x)); c.forEach((x) => (data.completed[x.id] = x))
  const cutoff = Date.now() - 3 * 86400000
  const stale = f.filter((r) => r.at < cutoff).map((r) => r.key)
  if (stale.length) void db.fired.bulkDelete(stale)
  return { data, settings: { ...DEFAULT_SETTINGS, ...(s?.value ?? {}) }, fired: new Set(f.filter((r) => r.at >= cutoff).map((r) => r.key)) }
}

/** Write the current value of each touched record (or delete it) in one transaction. */
export async function saveTouched(data: Data, touched: { table: TableName; id: string }[]) {
  await db.transaction('rw', [db.activities, db.tasks, db.completed], async () => {
    for (const { table, id } of touched) {
      const rec = (data[table] as Record<string, unknown>)[id]
      const tbl = db[table] as Table<unknown, string>
      if (rec === undefined) await tbl.delete(id); else await tbl.put(rec)
    }
  })
}
export const saveSettings = (value: Settings) => db.settings.put({ id: 'main', value })
export const saveFired = (keys: string[]) => db.fired.bulkPut(keys.map((key) => ({ key, at: Date.now() })))
export async function replaceAll(data: Data, settings?: Settings) {
  await db.transaction('rw', [db.activities, db.tasks, db.completed, db.settings, db.fired], async () => {
    await Promise.all([db.activities.clear(), db.tasks.clear(), db.completed.clear(), db.fired.clear()])
    await db.activities.bulkPut(Object.values(data.activities)); await db.tasks.bulkPut(Object.values(data.tasks)); await db.completed.bulkPut(Object.values(data.completed))
    if (settings) await db.settings.put({ id: 'main', value: settings })
  })
}
export async function wipeAll() { await replaceAll(emptyData()); await db.settings.clear() }

import type { Activity, CompletedTask, Data, Settings, Task } from './types'
import { DEFAULT_SETTINGS } from './types'

export const BACKUP_VERSION = 1
export interface Backup { app: 'daybloom'; version: number; exportedAt: string; data: Data; settings: Settings }

export const makeBackup = (data: Data, settings: Settings): Backup => ({ app: 'daybloom', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data, settings })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown) => typeof v === 'string'
const dateRe = /^\d{4}-\d{2}-\d{2}$/

function validActivity(a: unknown): a is Activity {
  if (!isObj(a) || !str(a.id) || !str(a.title) || !num(a.startMin) || !num(a.endMin) || !str(a.date) || !dateRe.test(a.date as string)) return false
  if (!['activity', 'focus'].includes(a.kind as string)) return false
  const r = a.recurrence
  return isObj(r) && ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(r.freq as string) && Array.isArray(r.weekdays) && isObj(a.exceptions) && isObj(a.hiddenTasks)
}
const validTask = (t: unknown): t is Task => isObj(t) && str(t.id) && str(t.title) && num(t.order) && num(t.createdAt)

/** Parse and validate a backup file. Never trusts input; returns a clear error instead of throwing. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'That file is not valid JSON.' } }
  if (!isObj(raw) || raw.app !== 'daybloom' || !isObj(raw.data)) return { ok: false, error: 'This does not look like a Daybloom backup.' }
  if (!num(raw.version) || (raw.version as number) > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of Daybloom.' }
  const d = raw.data
  const acts = d.activities, tasks = d.tasks, done = d.completed
  if (!isObj(acts) || !isObj(tasks) || !isObj(done)) return { ok: false, error: 'The backup is missing some sections.' }
  for (const [k, a] of Object.entries(acts)) if (!validActivity(a) || a.id !== k) return { ok: false, error: 'An activity in the backup is damaged.' }
  for (const [k, t] of Object.entries(tasks)) if (!validTask(t) || t.id !== k) return { ok: false, error: 'A task in the backup is damaged.' }
  for (const [k, t] of Object.entries(done)) if (!validTask(t) || t.id !== k || !num((t as unknown as CompletedTask).completedAt)) return { ok: false, error: 'A completed task in the backup is damaged.' }
  const settings = { ...DEFAULT_SETTINGS, ...(isObj(raw.settings) ? (raw.settings as Partial<Settings>) : {}) }
  return { ok: true, backup: { app: 'daybloom', version: raw.version as number, exportedAt: String(raw.exportedAt ?? ''), data: d as unknown as Data, settings } }
}

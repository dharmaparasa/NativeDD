export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface Recurrence { freq: Freq; weekdays: number[]; until?: string }
export type ColorKey = 'sky' | 'mint' | 'peach' | 'lemon' | 'lavender' | 'coral'
export interface Override { title?: string; startMin?: number; endMin?: number; color?: ColorKey }
export interface Exception { deleted?: boolean; override?: Override }

/** A scheduled activity *definition*. Occurrences are computed from it. */
export interface Activity {
  id: string
  title: string
  kind: 'activity' | 'focus'
  color: ColorKey
  startMin: number // minutes after local midnight
  endMin: number // <= 1439
  date: string // anchor date, YYYY-MM-DD (local)
  recurrence: Recurrence
  exceptions: Record<string, Exception> // by occurrence date
  hiddenTasks: Record<string, string[]> // focus blocks: date -> task ids hidden
  batchId?: string
  createdAt: number
}

export interface Occurrence {
  key: string // `${activityId}@${date}`
  activityId: string
  date: string
  title: string
  kind: Activity['kind']
  color: ColorKey
  startMin: number
  endMin: number
  recurring: boolean
}

export interface Task { id: string; title: string; note?: string; order: number; createdAt: number }
export interface CompletedTask extends Task { completedAt: number }

export interface SoundPref { on: boolean; volume: number }
export interface Settings {
  hourly: SoundPref
  start: SoundPref
  end: SoundPref
  systemNotifications: boolean
  focusCount: 2 | 3
  timeFormat: '12h' | '24h'
  haptics: boolean
}

export type TableName = 'activities' | 'tasks' | 'completed'
/** One reversible change to one record. `before`/`after` undefined = absent. */
export interface Op { table: TableName; id: string; before?: unknown; after?: unknown }
export interface Txn { id: string; label: string; ops: Op[] }
export interface Data {
  activities: Record<string, Activity>
  tasks: Record<string, Task>
  completed: Record<string, CompletedTask>
}
export const emptyData = (): Data => ({ activities: {}, tasks: {}, completed: {} })
export const DEFAULT_SETTINGS: Settings = {
  hourly: { on: true, volume: 0.6 },
  start: { on: true, volume: 0.6 },
  end: { on: true, volume: 0.6 },
  systemNotifications: false,
  focusCount: 3,
  timeFormat: '12h',
  haptics: true,
}
export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

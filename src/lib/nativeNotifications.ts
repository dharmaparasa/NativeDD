import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { Data, Settings } from './types'
import { occurrencesOn } from './recurrence'
import { addDays, todayStr } from './time'
import { buildEvents, type EventKind, type NotifyEvent } from './notify'

const MAX_PENDING_NOTIFICATIONS = 450
const SCHEDULE_DAYS = 14
const SOURCE = 'daybloom-native'
const SOUND_FILES: Record<EventKind, string> = {
  hourly: 'hourly.wav',
  start: 'start.wav',
  end: 'end.wav',
}
const CHANNELS: Record<EventKind, string> = {
  hourly: 'daybloom-hourly',
  start: 'daybloom-start',
  end: 'daybloom-end',
}

export const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export async function requestNativeNotificationPermissions() {
  const permission = await LocalNotifications.checkPermissions()
  const display = permission.display === 'granted'
    ? permission
    : await LocalNotifications.requestPermissions()
  if (display.display !== 'granted') return { display: display.display, exactAlarm: 'prompt' as const }

  const exact = await LocalNotifications.checkExactNotificationSetting()
  const exactAlarm = exact.exact_alarm === 'granted'
    ? exact
    : await LocalNotifications.changeExactNotificationSetting()
  const verified = await LocalNotifications.checkExactNotificationSetting()
  return { display: display.display, exactAlarm: verified.exact_alarm ?? exactAlarm.exact_alarm }
}

function notificationId(key: string, used: Set<number>) {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  let id = (hash >>> 0) & 0x7fffffff
  while (used.has(id)) id = (id + 1) & 0x7fffffff
  used.add(id)
  return id
}

export function buildNativeSchedule(data: Data, settings: Settings, now = Date.now(), days = SCHEDULE_DAYS) {
  if (!settings.systemNotifications) return { notifications: [] as LocalNotificationSchema[], truncated: 0 }

  const events: NotifyEvent[] = []
  const today = todayStr(new Date(now))
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(today, offset)
    events.push(...buildEvents(date, occurrencesOn(Object.values(data.activities), date)))
  }

  const future = events
    .filter((event) => event.at > now && settings[event.kind].on)
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
  const selected = future.slice(0, MAX_PENDING_NOTIFICATIONS)
  const used = new Set<number>()
  const notifications = selected.map((event) => ({
    id: notificationId(event.key, used),
    title: event.title,
    body: event.body ?? '',
    channelId: CHANNELS[event.kind],
    sound: SOUND_FILES[event.kind],
    schedule: { at: new Date(event.at), allowWhileIdle: true },
    extra: { source: SOURCE, key: event.key },
    autoCancel: true,
  }))
  return { notifications, truncated: future.length - selected.length }
}

async function ensureChannels() {
  await Promise.all((Object.keys(CHANNELS) as EventKind[]).map((kind) =>
    LocalNotifications.createChannel({
      id: CHANNELS[kind],
      name: `${kind === 'hourly' ? 'Hourly' : kind === 'start' ? 'Activity start' : 'Activity end'} reminders`,
      description: 'Daybloom timetable reminders',
      sound: SOUND_FILES[kind],
      importance: 4,
      visibility: 1,
      vibration: false,
    }),
  ))
}

async function sync(data: Data, settings: Settings) {
  if (!isAndroidNative()) return { scheduled: 0, truncated: 0 }
  await ensureChannels()
  if (!settings.systemNotifications) {
    const pending = await LocalNotifications.getPending()
    const owned = pending.notifications.filter((notification) => notification.extra?.source === SOURCE)
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(({ id }) => ({ id })) })
    return { scheduled: 0, truncated: 0 }
  }

  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return { scheduled: 0, truncated: 0 }

  const exact = await LocalNotifications.checkExactNotificationSetting()
  const { notifications, truncated } = buildNativeSchedule(data, settings)
  const exactNotifications = notifications.map((notification) => ({
    ...notification,
    isExactNotification: exact.exact_alarm === 'granted',
  }))
  const pending = await LocalNotifications.getPending()
  const owned = pending.notifications.filter((notification) => notification.extra?.source === SOURCE)
  const wantedIds = new Set(exactNotifications.map(({ id }) => id))
  const staleIds = owned.filter(({ id }) => !wantedIds.has(id)).map(({ id }) => ({ id }))
  if (staleIds.length) await LocalNotifications.cancel({ notifications: staleIds })

  const pendingIds = new Set(owned.filter(({ id }) => wantedIds.has(id)).map(({ id }) => id))
  const updates = exactNotifications.filter(({ id }) => pendingIds.has(id))
  const additions = exactNotifications.filter(({ id }) => !pendingIds.has(id))
  if (updates.length) await LocalNotifications.update({ notifications: updates })
  if (additions.length) {
    const result = await LocalNotifications.schedule({ notifications: additions })
    if (result.warning) console.warn('Native notification scheduling warning:', result.warning.message)
  }
  if (truncated) console.warn(`Native notification queue capped; ${truncated} later reminders were not scheduled.`)
  return { scheduled: exactNotifications.length, truncated }
}

let syncQueue: Promise<unknown> = Promise.resolve()
export function syncNativeNotifications(data: Data, settings: Settings) {
  const operation = syncQueue.then(() => sync(data, settings))
  syncQueue = operation.catch(() => undefined)
  return operation
}

export async function previewNativeSound(kind: EventKind) {
  if (!isAndroidNative()) return
  await ensureChannels()
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') throw new Error('Allow notification permission before previewing native sounds.')
  const exact = await LocalNotifications.checkExactNotificationSetting()
  const id = notificationId(`preview:${kind}:${Date.now()}`, new Set<number>())
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Daybloom sound preview',
      body: `${kind === 'hourly' ? 'Hourly' : kind === 'start' ? 'Activity start' : 'Activity end'} reminder`,
      channelId: CHANNELS[kind],
      sound: SOUND_FILES[kind],
      schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
      isExactNotification: exact.exact_alarm === 'granted',
      extra: { source: 'daybloom-preview' },
      autoCancel: true,
    }],
  })
}

export async function refreshNativeNotificationsOnResume(
  getState: () => { data: Data; settings: Settings },
) {
  if (!isAndroidNative()) return () => undefined
  let active = true
  const listener = await App.addListener('appStateChange', ({ isActive }) => {
    if (active && isActive) {
      const { data, settings } = getState()
      void syncNativeNotifications(data, settings).catch((error: unknown) => {
        console.error('Could not refresh native notifications on resume', error)
      })
    }
  })
  return () => { active = false; void listener.remove() }
}

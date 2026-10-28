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
  hourly: 'daybloom-v2-hourly',
  start: 'daybloom-v2-start',
  end: 'daybloom-v2-end',
}
const TEST_NOTIFICATION_IDS: Record<EventKind, number> = {
  hourly: 2_147_483_600,
  start: 2_147_483_601,
  end: 2_147_483_602,
}

export const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

function exactAlarmAccessRequired() {
  return new Error('Enable “Alarms & reminders” for Daybloom to schedule exact reminders.')
}

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

let channelsReady: Promise<void> | undefined
function ensureChannels() {
  channelsReady ??= (async () => {
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
    const { channels } = await LocalNotifications.listChannels()
    for (const kind of Object.keys(CHANNELS) as EventKind[]) {
      const channel = channels.find(({ id }) => id === CHANNELS[kind])
      const expectedSound = `/raw/${SOUND_FILES[kind].replace(/\.wav$/, '')}`
      if (!channel || !channel.sound?.endsWith(expectedSound) || (channel.importance ?? 0) < 3) {
        console.error('[Daybloom notifications] Channel configuration mismatch', {
          id: CHANNELS[kind],
          expectedSound,
          actualSound: channel?.sound,
          importance: channel?.importance,
        })
      } else {
        console.info('[Daybloom notifications] Channel ready', {
          id: channel.id,
          sound: channel.sound,
          importance: channel.importance,
        })
      }
    }
  })()
  return channelsReady
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
  if (exact.exact_alarm !== 'granted') {
    const pending = await LocalNotifications.getPending()
    const owned = pending.notifications.filter((notification) => notification.extra?.source === SOURCE)
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(({ id }) => ({ id })) })
    console.error('[Daybloom notifications] Exact-alarm access is unavailable; reminders were not scheduled.')
    return { scheduled: 0, truncated: 0 }
  }

  const { notifications, truncated } = buildNativeSchedule(data, settings)
  const exactNotifications = notifications.map((notification) => ({
    ...notification,
    isExactNotification: true,
    isExactMandatory: true,
  }))
  console.info('[Daybloom notifications] Scheduling reminders', {
    count: exactNotifications.length,
    exactAlarm: exact.exact_alarm,
    firstAt: exactNotifications[0]?.schedule?.at?.toISOString(),
    lastAt: exactNotifications[exactNotifications.length - 1]?.schedule?.at?.toISOString(),
  })
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

export async function scheduleNativeTestAlarm(kind: EventKind = 'start') {
  if (!isAndroidNative()) throw new Error('Test alarms are only available in the Android app.')
  await ensureChannels()
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') throw new Error('Allow notification permission before scheduling a test alarm.')
  const exact = await LocalNotifications.checkExactNotificationSetting()
  if (exact.exact_alarm !== 'granted') throw exactAlarmAccessRequired()

  const at = new Date(Date.now() + 2 * 60_000)
  const id = TEST_NOTIFICATION_IDS[kind]
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Daybloom test alarm',
      body: `${kind === 'hourly' ? 'Hourly' : kind === 'start' ? 'Activity start' : 'Activity end'} sound · scheduled for ${at.toLocaleTimeString()}`,
      channelId: CHANNELS[kind],
      sound: SOUND_FILES[kind],
      schedule: { at, allowWhileIdle: true },
      isExactNotification: true,
      isExactMandatory: true,
      extra: { source: 'daybloom-test', kind },
      autoCancel: true,
    }],
  })
  console.info('[Daybloom notifications] Test alarm scheduled', {
    id,
    channelId: CHANNELS[kind],
    sound: SOUND_FILES[kind],
    expectedAt: at.toISOString(),
  })
  return at
}

export async function refreshNativeNotificationsOnResume(
  getState: () => { data: Data; settings: Settings },
) {
  if (!isAndroidNative()) return () => undefined
  let active = true
  const notificationListener = await LocalNotifications.addListener('localNotificationReceived', (notification) => {
    if (notification.extra?.source !== SOURCE && notification.extra?.source !== 'daybloom-test') return
    console.info('[Daybloom notifications] Native receiver reported notification', {
      id: notification.id,
      expectedAt: notification.schedule?.at,
      receivedAt: new Date().toISOString(),
    })
  })
  const listener = await App.addListener('appStateChange', ({ isActive }) => {
    if (active && isActive) {
      const { data, settings } = getState()
      void syncNativeNotifications(data, settings).catch((error: unknown) => {
        console.error('Could not refresh native notifications on resume', error)
      })
    }
  })
  return () => {
    active = false
    void listener.remove()
    void notificationListener.remove()
  }
}

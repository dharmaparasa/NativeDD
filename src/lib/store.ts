import { useSyncExternalStore } from 'react'
import type { Data, Op, Settings } from './types'
import { DEFAULT_SETTINGS, emptyData, uid } from './types'
import { History, applyTxn } from './undo'
import * as persist from './db'
import { setTimeFormat } from './time'

export interface Toast { id: number; message: string; action: 'undo' | 'redo' | null }
export interface State { ready: boolean; data: Data; settings: Settings; canUndo: boolean; canRedo: boolean; toast: Toast | null }

class Store {
  private s: State = { ready: false, data: emptyData(), settings: DEFAULT_SETTINGS, canUndo: false, canRedo: false, toast: null }
  private listeners = new Set<() => void>()
  private toastId = 0
  history = new History()
  fired = new Set<string>()
  persistent = true

  getState = () => this.s
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l) } }
  private set(p: Partial<State>) {
    this.s = { ...this.s, ...p, canUndo: this.history.canUndo, canRedo: this.history.canRedo }
    this.listeners.forEach((l) => l())
  }

  async init() {
    try {
      const { data, settings, fired } = await persist.loadAll()
      this.fired = fired; setTimeFormat(settings.timeFormat)
      this.set({ data, settings, ready: true })
    } catch (e) {
      console.error('Could not open local storage', e)
      this.persistent = false
      this.set({ ready: true, toast: { id: ++this.toastId, message: 'Storage is unavailable — changes won’t be saved.', action: null } })
    }
  }

  /** Apply a transaction, persist it, and record it for undo. */
  commit(label: string, ops: Op[], toast?: string) {
    if (!ops.length) return
    const txn = { id: uid(), label, ops }
    const { data, touched } = applyTxn(this.s.data, ops, 'do')
    this.history.push(txn)
    this.save(data, touched)
    this.set({ data, toast: toast ? { id: ++this.toastId, message: toast, action: 'undo' } : this.s.toast })
  }
  undo() {
    const t = this.history.popUndo(); if (!t) return
    const { data, touched } = applyTxn(this.s.data, t.ops, 'undo')
    this.save(data, touched)
    this.set({ data, toast: { id: ++this.toastId, message: `Undid: ${t.label}`, action: 'redo' } })
  }
  redo() {
    const t = this.history.popRedo(); if (!t) return
    const { data, touched } = applyTxn(this.s.data, t.ops, 'do')
    this.save(data, touched)
    this.set({ data, toast: { id: ++this.toastId, message: `Redid: ${t.label}`, action: 'undo' } })
  }
  private save(data: Data, touched: { table: Op['table']; id: string }[]) {
    if (!this.persistent) return
    persist.saveTouched(data, touched).catch((e) => { console.error(e); this.showToast('Couldn’t save that change.') })
  }
  showToast(message: string, action: Toast['action'] = null) { this.set({ toast: { id: ++this.toastId, message, action } }) }
  dismissToast() { this.set({ toast: null }) }

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...this.s.settings, ...patch }
    setTimeFormat(settings.timeFormat)
    if (this.persistent) void persist.saveSettings(settings)
    this.set({ settings })
  }
  markFired(keys: string[]) { keys.forEach((k) => this.fired.add(k)); if (this.persistent) void persist.saveFired(keys) }

  async replaceAll(data: Data, settings: Settings) {
    if (this.persistent) await persist.replaceAll(data, settings)
    this.history.clear(); this.fired.clear(); setTimeFormat(settings.timeFormat)
    this.set({ data, settings })
  }
  async clearAll() {
    if (this.persistent) await persist.wipeAll()
    this.history.clear(); this.fired.clear(); setTimeFormat(DEFAULT_SETTINGS.timeFormat)
    this.set({ data: emptyData(), settings: DEFAULT_SETTINGS })
  }
}
export const store = new Store()
export const useStore = () => useSyncExternalStore(store.subscribe, store.getState)

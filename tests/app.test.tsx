// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { store } from '../src/lib/store'
import { cmd } from '../src/lib/commands'
import { todayStr } from '../src/lib/time'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
Element.prototype.scrollTo = vi.fn() as never
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never

describe('app smoke test', () => {
  it('renders the day, a Focus Block with tasks, completes inline, and undoes', async () => {
    const { default: App } = await import('../src/App')
    const el = document.createElement('div'); document.body.appendChild(el)
    await act(async () => { await store.init(); createRoot(el).render(<App />) })
    expect(el.textContent).toContain('A fresh, open day')

    await act(async () => {
      cmd.createActivity({ title: 'Deep work', date: todayStr(), startMin: 600, endMin: 660, kind: 'focus' })
      for (const t of ['Write report', 'Pay bill', 'Call mum', 'Book flights']) cmd.addTask(t, 'bottom')
    })
    expect(el.textContent).toContain('Deep work')
    for (const t of ['Write report', 'Pay bill', 'Call mum']) expect(el.textContent).toContain(t)
    expect(el.textContent).not.toContain('Book flights')

    await act(async () => { el.querySelector<HTMLButtonElement>('button[aria-label="Mark “Write report” done"]')!.click() })
    const card = () => el.querySelector('[data-card]')!.textContent!
    expect(card()).not.toContain('Write report'); expect(card()).toContain('Book flights') // next task fills in
    expect(el.textContent).toContain('Undo')
    await act(async () => { store.undo() })
    expect(card()).toContain('Write report'); expect(card()).not.toContain('Book flights')

    await act(async () => { [...el.querySelectorAll('nav button')].find((b) => b.textContent?.includes('Inbox'))!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(el.textContent).toContain('Priority Inbox')
    for (const name of ['History', 'Settings']) {
      await act(async () => { [...el.querySelectorAll('nav button')].find((b) => b.textContent?.includes(name))!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    }
    expect(el.textContent).toContain('Hourly chime')
  })
})

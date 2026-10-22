import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] bg-cream shadow-soft md:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-3 pt-1">{children}</div>
        {footer && <div className="px-5 pb-[calc(1rem+var(--safe-b))] pt-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-[#3FBF88]' : 'bg-[#DCD5C6]'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-2xl bg-[#F6EFE0] p-1">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`rounded-xl px-3.5 py-1.5 text-sm font-bold transition ${o.value === value ? 'bg-white shadow-card' : 'text-ink-soft'}`}>{o.label}</button>
      ))}
    </div>
  )
}

export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean }
/** Small floating menu anchored at a point; closes on outside press, Escape or scroll. */
export function PopMenu({ x, y, items, onClose, label }: { x: number; y: number; items: MenuItem[]; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!
    const w = el.offsetWidth, h = el.offsetHeight
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - h - 8))}px`
    el.querySelector<HTMLButtonElement>('button')?.focus()
    const down = (e: PointerEvent) => { if (!el.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', down, true); window.addEventListener('keydown', key); window.addEventListener('wheel', onClose, { passive: true })
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); window.removeEventListener('wheel', onClose) }
  }, [x, y, onClose])
  return (
    <div ref={ref} role="menu" aria-label={label} className="anim-pop no-select fixed z-[60] min-w-[190px] rounded-2xl border border-line bg-white p-1.5 shadow-soft" style={{ left: x, top: y }}>
      {items.map((it) => (
        <button key={it.label} role="menuitem" onClick={() => { onClose(); it.onClick() }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-bold hover:bg-[#FFF6E5] ${it.danger ? 'text-[#C23B35]' : ''}`}>
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  )
}

export function ScopeDialog({ verb, onPick, onClose }: { verb: 'Edit' | 'Delete'; onPick: (s: 'this' | 'future' | 'all') => void; onClose: () => void }) {
  const opts = [{ v: 'this' as const, l: 'This occurrence only' }, { v: 'future' as const, l: 'This and following' }, { v: 'all' as const, l: 'Entire series' }]
  return (
    <Sheet title={`${verb} repeating activity`} onClose={onClose}>
      <div className="flex flex-col gap-2 pb-3">
        {opts.map((o) => <button key={o.v} className="btn-soft justify-start" onClick={() => onPick(o.v)}>{o.l}</button>)}
      </div>
    </Sheet>
  )
}

import type { EventKind } from './notify'

export interface Note { freq: number; at: number; dur: number; type: OscillatorType; gain: number; partial?: number }
/** Three clearly different, gentle sounds — generated, no audio files. */
export function soundRecipe(kind: EventKind): Note[] {
  switch (kind) {
    case 'hourly': // soft two-note bell, long decay
      return [
        { freq: 659.25, at: 0, dur: 1.8, type: 'sine', gain: 1, partial: 2.76 },
        { freq: 987.77, at: 0.28, dur: 2.2, type: 'sine', gain: 0.85, partial: 2.76 },
      ]
    case 'start': // bright rising triad
      return [523.25, 659.25, 783.99].map((freq, i) => ({ freq, at: i * 0.12, dur: 0.5, type: 'triangle' as const, gain: 0.9 }))
    case 'end': // mellow falling pair
      return [{ freq: 880, at: 0, dur: 0.6, type: 'sine', gain: 0.9 }, { freq: 587.33, at: 0.2, dur: 0.9, type: 'sine', gain: 0.8 }]
  }
}

let ctx: AudioContext | null = null
function getCtx() {
  const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!AC) return null
  ctx ??= new AC()
  return ctx
}
/** Call from a user gesture; browsers keep audio suspended until then. */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx(); if (!c) return false
  if (c.state !== 'running') { try { await c.resume() } catch { /* needs a gesture */ } }
  return c.state === 'running'
}
export const audioReady = () => ctx?.state === 'running'

export async function playSound(kind: EventKind, volume: number): Promise<boolean> {
  if (!(await unlockAudio())) return false
  const c = ctx!
  const peak = 0.28 * Math.max(0, Math.min(1, volume)) ** 2
  if (peak <= 0) return true
  const t0 = c.currentTime + 0.03
  for (const n of soundRecipe(kind)) {
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0 + n.at)
    g.gain.linearRampToValueAtTime(peak * n.gain, t0 + n.at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
    g.connect(c.destination)
    const freqs = [[n.freq, 1], ...(n.partial ? [[n.freq * n.partial, 0.18]] : [])]
    for (const [f, mult] of freqs) {
      const o = c.createOscillator(); o.type = n.type; o.frequency.value = f
      const pg = c.createGain(); pg.gain.value = mult; o.connect(pg); pg.connect(g)
      o.start(t0 + n.at); o.stop(t0 + n.at + n.dur + 0.05)
    }
  }
  return true
}
export const haptic = (enabled: boolean, ms = 10) => { if (enabled && 'vibrate' in navigator) try { navigator.vibrate(ms) } catch { /* ignore */ } }

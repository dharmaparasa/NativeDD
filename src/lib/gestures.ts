/** Detects a double tap/click: two taps within `ms` and `px` of each other. */
export class DoubleTap {
  private last: { t: number; x: number; y: number } | null = null
  constructor(private ms = 350, private px = 30) {}
  register(x: number, y: number, t: number): boolean {
    const l = this.last
    if (l && t - l.t <= this.ms && Math.hypot(x - l.x, y - l.y) <= this.px) { this.last = null; return true }
    this.last = { t, x, y }
    return false
  }
  reset() { this.last = null }
}
/** A press that barely moved counts as a tap (not a scroll/drag). */
export const isTap = (dx: number, dy: number, px = 10) => Math.hypot(dx, dy) <= px
/** Horizontal swipe → 'next' (swipe left) / 'prev' (swipe right). */
export function swipeDirection(dx: number, dy: number, dt: number): 'next' | 'prev' | null {
  if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return null
  return dx < 0 ? 'next' : 'prev'
}

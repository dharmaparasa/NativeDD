export const HOUR_H = 96
export const PX_PER_MIN = HOUR_H / 60
export const DAY_H = HOUR_H * 24
export const minutesToY = (min: number) => min * PX_PER_MIN

/** Map a y-offset inside the timeline to minutes, snapped down to `snap`. */
export function yToMinutes(y: number, snap = 15) {
  const raw = Math.max(0, Math.min(1439, y / PX_PER_MIN))
  return Math.min(1425, Math.floor(raw / snap) * snap)
}

export interface LayoutItem { id: string; startMin: number; endMin: number; minMin?: number }
export interface Placement { col: number; cols: number }
/** Lay out overlapping items in side-by-side columns so none are hidden. */
export function layoutOverlaps(items: LayoutItem[]): Map<string, Placement> {
  const out = new Map<string, Placement>()
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  let cluster: { id: string; col: number }[] = []
  let colEnds: number[] = []
  let clusterEnd = -1
  const flush = () => { for (const c of cluster) out.set(c.id, { col: c.col, cols: colEnds.length }); cluster = []; colEnds = []; clusterEnd = -1 }
  for (const it of sorted) {
    const end = Math.max(it.endMin, it.startMin + (it.minMin ?? 30))
    if (cluster.length && it.startMin >= clusterEnd) flush()
    let col = colEnds.findIndex((e) => e <= it.startMin)
    if (col === -1) { col = colEnds.length; colEnds.push(end) } else colEnds[col] = end
    cluster.push({ id: it.id, col })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return out
}
export const progressOf = (nowMin: number, start: number, end: number) =>
  nowMin < start || nowMin >= end ? null : (nowMin - start) / Math.max(1, end - start)

import type { ColorKey } from './types'
export const COLORS: Record<ColorKey, { name: string; bg: string; border: string; accent: string }> = {
  sky: { name: 'Sky', bg: '#E4F3FE', border: '#BFE1F8', accent: '#4AA8E8' },
  mint: { name: 'Mint', bg: '#E2F7EC', border: '#B9E8CF', accent: '#3FBF88' },
  peach: { name: 'Peach', bg: '#FFEBDD', border: '#FFD1B3', accent: '#F59A5B' },
  lemon: { name: 'Lemon', bg: '#FFF7D1', border: '#F7E48E', accent: '#E8B923' },
  lavender: { name: 'Lavender', bg: '#EEE8FD', border: '#D5C8F7', accent: '#8F72E6' },
  coral: { name: 'Coral', bg: '#FFE3E1', border: '#FBC1BD', accent: '#EE6F69' },
}
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

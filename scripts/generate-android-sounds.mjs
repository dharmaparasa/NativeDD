import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sampleRate = 24000
const recipes = {
  hourly: [
    { freq: 659.25, at: 0, dur: 1.8, gain: 1, partial: 2.76 },
    { freq: 987.77, at: 0.28, dur: 2.2, gain: 0.85, partial: 2.76 },
  ],
  start: [523.25, 659.25, 783.99].map((freq, index) => ({
    freq, at: index * 0.12, dur: 0.5, gain: 0.9, triangle: true,
  })),
  end: [
    { freq: 880, at: 0, dur: 0.6, gain: 0.9 },
    { freq: 587.33, at: 0.2, dur: 0.9, gain: 0.8 },
  ],
}

function wave(note, elapsed) {
  const phase = 2 * Math.PI * note.freq * elapsed
  const fundamental = note.triangle
    ? (2 / Math.PI) * Math.asin(Math.sin(phase))
    : Math.sin(phase)
  const partial = note.partial
    ? 0.18 * Math.sin(phase * note.partial)
    : 0
  const envelope = Math.min(1, elapsed / 0.015) * Math.exp(-6 * elapsed / note.dur)
  return (fundamental + partial) * note.gain * 0.22 * envelope
}

function wav(notes) {
  const duration = Math.max(...notes.map(({ at, dur }) => at + dur))
  const count = Math.ceil(duration * sampleRate)
  const data = Buffer.alloc(count * 2)
  for (let frame = 0; frame < count; frame++) {
    const time = frame / sampleRate
    const sample = notes.reduce((sum, note) => {
      const elapsed = time - note.at
      return elapsed >= 0 && elapsed <= note.dur ? sum + wave(note, elapsed) : sum
    }, 0)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), frame * 2)
  }

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const output = join('android', 'app', 'src', 'main', 'res', 'raw')
mkdirSync(output, { recursive: true })
for (const [name, notes] of Object.entries(recipes)) {
  writeFileSync(join(output, `${name}.wav`), wav(notes))
}

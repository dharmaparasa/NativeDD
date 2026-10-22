// Post-build check: asset paths match the base, manifest scope is right, and the service worker precaches the shell (offline).
import { readFileSync, existsSync } from 'node:fs'
import { resolveBase } from '../build/base.js'

const base = resolveBase(process.env)
const fail = (m) => { console.error('✗', m); process.exit(1) }
const ok = (m) => console.log('✓', m)

if (!existsSync('dist/index.html')) fail('dist/index.html missing — run `npm run build` first')
const html = readFileSync('dist/index.html', 'utf8')
const urls = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1])
const bad = urls.filter((u) => !u.startsWith(base))
if (!urls.length) fail('no asset URLs found in index.html')
if (bad.length) fail(`asset URLs outside base "${base}": ${bad.join(', ')}`)
ok(`index.html assets all live under base "${base}" (${urls.length} urls)`)

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'))
if (manifest.start_url !== base || manifest.scope !== base) fail(`manifest start_url/scope must be "${base}"`)
ok('manifest start_url and scope match base')

if (!existsSync('dist/sw.js')) fail('dist/sw.js missing')
const sw = readFileSync('dist/sw.js', 'utf8')
if (!sw.includes('index.html')) fail('service worker does not precache index.html')
if (!/\.js/.test(sw) || !sw.includes('assets/')) fail('service worker does not precache the JS bundle')
ok('service worker precaches index.html and bundles (offline-ready)')

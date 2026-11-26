import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'

// Check the real build without a server, local TLS certificates or browser permissions.
const root = resolve('dist')
const base = process.env.VITE_BASE_PATH || '/'
assert.ok(base.startsWith('/') && base.endsWith('/') && !base.includes('..') && !base.includes('//'), 'VITE_BASE_PATH must be / or /repository/')
const site = new URL(base, 'https://pages-check.example')
let checks = 0
async function checkURL(value) {
  const url = new URL(value, site)
  assert.equal(url.origin, site.origin)
  assert.ok(url.pathname.startsWith(base), `URL escapes deployment path: ${value}`)
  const file = resolve(root, decodeURIComponent(url.pathname.slice(base.length)))
  assert.ok(file.startsWith(root + sep), `URL escapes dist: ${value}`)
  assert.ok((await stat(file)).isFile(), `Missing build asset: ${value}`)
  checks++
}

const html = await readFile(resolve(root, 'index.html'), 'utf8')
assert.ok(!html.includes('%BASE_URL%'), 'Vite did not substitute BASE_URL')
for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#)/.test(value)) continue
  await checkURL(value)
}

// Workers import these public runtimes and models using the same base URL as the page.
const publicAssets = [
  'arcade.svg', 'rubber.svg', 'watertouch.svg', 'snow.svg', 'papa.svg', 'particle.svg',
  'hand-tracker.js', 'snow-tracker.js', 'papa-tracker.js', 'particle-tracker.js',
  'rubber-tracker.js', 'minecraft-tracker.js', 'character-scan-worker.js',
  'papa-runtime.js', 'particle-runtime.js', 'rubber-runtime.js', 'invisible-runtime.js', 'minecraft-segmenter.js',
  'mediapipe/vision_bundle.js', 'mediapipe/wasm/vision_wasm_internal.js',
  'mediapipe/wasm/vision_wasm_internal.wasm', 'mediapipe/wasm/vision_wasm_internal.wasm.gz',
  'mediapipe/hand_landmarker.task', 'mediapipe/face_landmarker.task',
  'mediapipe/gesture_recognizer.task', 'mediapipe/pose_landmarker_lite.task', 'mediapipe/selfie_segmenter.tflite',
]
for (const name of publicAssets) await checkURL(base + name)

for (const entry of await readdir(resolve(root, 'assets'))) {
  if (!entry.endsWith('.js')) continue
  const code = await readFile(resolve(root, 'assets', entry), 'utf8')
  assert.ok(!/["'`]\/(?:arcade|rubber|watertouch|snow|papa|particle)\.svg/.test(code), `Root-only favicon URL in ${entry}`)
  assert.ok(!/["'`]\/mediapipe\//.test(code), `Root-only model URL in ${entry}`)
}

async function checkPrivateFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name)
    assert.ok(!/^(?:\.certs|\.dev-tools|\.git|server)$/.test(entry.name) && !/\.(?:pem|key|crt)$/i.test(entry.name), `Private/server file in dist: ${relative(root, file)}`)
    if (entry.isDirectory()) await checkPrivateFiles(file)
  }
}
await checkPrivateFiles(root)
console.log(`Pages build verified: base=${base}, ${checks} entry/worker/runtime/model URLs; no private development files.`)

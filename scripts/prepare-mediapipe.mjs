import { mkdir, copyFile, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
const destination = new URL('../public/mediapipe/', import.meta.url)
const source = new URL('../node_modules/@mediapipe/tasks-vision/', import.meta.url)
await mkdir(new URL('wasm/', destination), { recursive: true })
for (const name of ['vision_bundle.js', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm']) {
  await copyFile(new URL(name, source), new URL(name, destination))
}
const model = new URL('hand_landmarker.task', destination)
try { await access(model) } catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task')
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(model))
}
console.log('MediaPipe SDK, WASM and hand model ready locally.')

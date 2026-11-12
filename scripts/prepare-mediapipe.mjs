import { mkdir, copyFile, access, rename, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
const destination = new URL('../public/mediapipe/', import.meta.url)
const source = new URL('../node_modules/@mediapipe/tasks-vision/', import.meta.url)
await mkdir(new URL('wasm/', destination), { recursive: true })
for (const name of ['vision_bundle.js', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm']) {
  await copyFile(new URL(name, source), new URL(name, destination))
}
const models = [
  ['hand_landmarker.task', 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'],
  ['face_landmarker.task', 'face_landmarker/face_landmarker/float16/1/face_landmarker.task'],
  ['selfie_segmenter.tflite', 'image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'],
]
await Promise.all(models.map(async ([filename, path]) => {
  const model = new URL(filename, destination)
  try { await access(model); return } catch {}
  const temporary = new URL(filename + '.download', destination)
  try {
    const response = await fetch('https://storage.googleapis.com/mediapipe-models/' + path)
    if (!response.ok) throw new Error(`Model download failed: ${filename} (${response.status})`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
    await rename(temporary, model)
  } catch (error) { await rm(temporary, { force: true }); throw error }
}))
console.log('MediaPipe SDK, WASM, hand, face and HumanSeg models ready locally.')

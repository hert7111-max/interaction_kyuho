import { CONFIG } from '../config.js'

let visionPromise
function loadVision(url) {
  if (globalThis.Vision) return Promise.resolve(globalThis.Vision)
  visionPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => resolve(globalThis.Vision)
    script.onerror = () => {
      script.remove()
      visionPromise = undefined
      reject(new Error('Vision runtime unavailable'))
    }
    document.head.append(script)
  })
  return visionPromise
}

export class ScanTracker {
  worker = null
  main = null
  connections = []
  closed = false
  pending = null
  context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  constructor(mode = 'pose') {
    this.mode = mode
    this.settings = mode === 'gesture' ? { ...CONFIG.tracking, ...CONFIG.gesture.tracking } : CONFIG.tracking
  }

  get interval() { return this.worker ? this.settings.intervalMs : this.settings.mainThreadIntervalMs }

  async init() {
    const settings = this.settings
    const root = new URL(import.meta.env.BASE_URL, location.href)
    const paths = Object.fromEntries(['sdk', 'wasm', 'model'].map(name => [name, new URL(settings[name], root).href]))
    if (globalThis.Worker && globalThis.OffscreenCanvas) {
      try {
        this.worker = new Worker(new URL(settings.worker, root))
        this.worker.onmessage = ({ data }) => {
          if (data.type === 'error') this.settle(new Error(data.message))
          else if (this.pending) this.settle(null, data)
          else data.bitmap?.close()
        }
        this.worker.onerror = () => this.settle(new Error('Vision worker unavailable'))
        const response = await this.send({ type: 'init', mode: this.mode, ...paths, options: settings.options }, [], settings.initTimeoutMs)
        this.connections = response.connections
        return
      } catch {
        this.worker?.terminate()
        this.worker = null
        if (this.closed) return
      }
    }
    const vision = await loadVision(paths.sdk)
    if (this.closed) return
    const files = await vision.FilesetResolver.forVisionTasks(paths.wasm)
    if (this.closed) return
    const Task = this.mode === 'gesture' ? vision.GestureRecognizer : vision.PoseLandmarker
    const main = await Task.createFromOptions(files, {
      ...settings.options, baseOptions: { modelAssetPath: paths.model, delegate: 'CPU' },
    })
    if (this.closed) main.close()
    else this.main = main
    this.connections = Task.POSE_CONNECTIONS ?? []
  }

  send(data, transfer, timeout = this.settings.frameTimeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => this.settle(new Error('Tracking timed out')), timeout)
      this.pending = { resolve, reject, timer }
      try { this.worker.postMessage(data, transfer) } catch (error) { this.settle(error) }
    })
  }

  settle(error, value) {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    clearTimeout(pending.timer)
    if (error) pending.reject(error)
    else pending.resolve(value)
  }

  async frame(video, timestamp) {
    const scale = Math.min(1, this.settings.longestFrameEdge / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.max(1, Math.round(video.videoWidth * scale))
    const h = Math.max(1, Math.round(video.videoHeight * scale))
    const ctx = this.context
    if (ctx.canvas.width !== w) ctx.canvas.width = w
    if (ctx.canvas.height !== h) ctx.canvas.height = h

    if (this.worker && typeof createImageBitmap === 'function') {
      let bitmap
      try { bitmap = await createImageBitmap(video, { resizeWidth: w, resizeHeight: h }) } catch { /* Draw into the capture buffer below. */ }
      if (this.closed) { bitmap?.close(); return null }
      if (bitmap) {
        let result
        try {
          result = await this.send({ type: 'frame', bitmap, w, h, timestamp }, [bitmap])
          if (this.mode === 'gesture' || !result.landmarks) return result
          ctx.drawImage(result.bitmap, 0, 0, w, h)
          return { ...result, pixels: ctx.getImageData(0, 0, w, h) }
        } finally { (result?.bitmap ?? bitmap).close() }
      }
    }
    if (this.closed) return null
    ctx.drawImage(video, 0, 0, w, h)
    if (this.worker) {
      const pixels = ctx.getImageData(0, 0, w, h)
      const copy = this.mode === 'gesture' ? pixels.data : pixels.data.slice()
      const result = await this.send({ type: 'frame', pixels: copy, w, h, timestamp }, [copy.buffer])
      return this.mode === 'gesture' ? result : { ...result, pixels }
    }

    if (this.mode === 'gesture') {
      const result = this.main.recognizeForVideo(ctx.canvas, timestamp)
      return {
        timestamp, landmarks: result.landmarks[0] ?? null, category: result.gestures[0]?.[0] ?? null,
        handId: (result.handedness ?? result.handednesses)?.[0]?.[0]?.categoryName,
      }
    }
    let frame
    this.main.detectForVideo(ctx.canvas, timestamp, result => {
      const landmarks = result.landmarks[0] ?? null
      const part = result.segmentationMasks?.[0]
      const mask = part ? {
        pixels: Uint8Array.from(part.getAsFloat32Array(), value => Math.round(value * 255)),
        width: part.width, height: part.height,
      } : null
      frame = { timestamp, landmarks, mask, pixels: landmarks ? ctx.getImageData(0, 0, w, h) : null }
    })
    return frame
  }

  close() {
    this.closed = true
    this.settle(new Error('Tracking closed'))
    this.worker?.terminate()
    this.worker = null
    this.main?.close()
    this.main = null
  }
}

import type { PersonMask } from './minecraft-combat'
import type { Landmark } from './invisible-clap'
import { BackgroundCapture } from './minecraft-background'

export type BodyFrame = PersonMask & { poses: Landmark[][] }
type Runtime = {
  init(base: string): Promise<void>
  detect(source: HTMLCanvasElement, timestamp: number): BodyFrame
  close(): void
}
type Reply = (BodyFrame & { type: 'mask'; duration: number; generation: number }) |
  { type: 'ready'; cpu: boolean } | { type: 'error'; message: string }

const globals = window as Window & { Vision?: unknown; InvisibleRuntime?: new () => Runtime; MineSegmenter?: unknown }
const scripts = new Map<string, Promise<void>>()
function loadScript(url: URL) {
  let pending = scripts.get(url.href)
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url.href
      script.onload = () => resolve()
      script.onerror = () => {
        scripts.delete(url.href)
        script.remove()
        reject(new Error('MediaPipe loader failed'))
      }
      document.head.append(script)
    })
    scripts.set(url.href, pending)
  }
  return pending
}

export class InvisibleTracker {
  readonly background = new BackgroundCapture()
  onFrame: (data: BodyFrame) => void = () => {}
  onError: () => void = () => {}
  private worker: Worker | null = null
  private main: Runtime | null = null
  private canvas = document.createElement('canvas')
  private context = this.canvas.getContext('2d', { willReadFrequently: true })
  private timer = 0
  private generation = 0
  private closed = false
  private busy = false
  private ready = false
  private cpu = false
  private lastVideo = -1
  private lastCapture = -Infinity
  private average = 24
  private bitmapMode = true
  private cancelInit: (() => void) | null = null
  private base = new URL(import.meta.env.BASE_URL, location.href)

  async init() {
    try {
      if (!globalThis.Worker || !globalThis.OffscreenCanvas) throw new Error('Worker unavailable')
      await this.initWorker()
      return
    } catch {
      this.worker?.terminate()
      this.worker = null
      if (this.closed) return
    }
    if (!this.context) throw new Error('Camera copy unavailable')
    if (!globals.Vision) await loadScript(new URL('mediapipe/vision_bundle.js', this.base))
    if (!globals.MineSegmenter) await loadScript(new URL('minecraft-segmenter.js', this.base))
    if (!globals.InvisibleRuntime) await loadScript(new URL('invisible-runtime.js', this.base))
    if (this.closed) return
    const runtime = new globals.InvisibleRuntime!()
    this.main = runtime
    await runtime.init(this.base.href)
    this.cpu = true
    if (!this.closed) this.ready = true
  }

  private initWorker() {
    const worker = new Worker(new URL('minecraft-tracker.js', this.base))
    this.worker = worker
    return new Promise<void>((resolve, reject) => {
      const fail = () => {
        clearTimeout(this.timer)
        this.cancelInit = null
        if (this.ready) this.onError()
        else reject(new Error('Worker initialization failed'))
      }
      this.timer = window.setTimeout(fail, 30000)
      this.cancelInit = fail
      worker.onerror = fail
      worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        if (this.closed || this.worker !== worker) return
        clearTimeout(this.timer)
        if (data.type === 'ready') {
          this.cpu = data.cpu
          this.ready = true
          this.cancelInit = null
          resolve()
        } else if (data.type === 'mask') {
          this.busy = false
          if (data.generation === this.generation) this.receive(data, data.duration)
        } else fail()
      }
      worker.postMessage({ type: 'init', base: this.base.href, pose: true })
    })
  }

  private receive(data: BodyFrame, duration: number) {
    this.average += (duration - this.average) * .2
    this.background.observe(data)
    this.onFrame(data)
  }

  private sample(source: CanvasImageSource, video: HTMLVideoElement, now: number) {
    try { this.background.sample(source, video.videoWidth, video.videoHeight, now) }
    catch { /* Mask and pose tracking can continue independently of background readback. */ }
  }

  async capture(video: HTMLVideoElement, now: number) {
    const interval = Math.min(200, Math.max(this.main ? 100 : this.cpu ? 78 : 55, this.average * 2))
    if (this.closed || !this.ready || this.busy || now - this.lastCapture < interval ||
        video.readyState < 2 || video.currentTime === this.lastVideo) return

    this.busy = true
    this.lastVideo = video.currentTime
    this.lastCapture = now
    const generation = this.generation
    const scale = Math.min(1, (this.cpu ? 432 : 544) / Math.max(video.videoWidth, video.videoHeight))
    const width = Math.max(1, Math.round(video.videoWidth * scale))
    const height = Math.max(1, Math.round(video.videoHeight * scale))
    const worker = this.worker
    try {
      const frame = { type: 'frame', timestamp: now, generation }
      if (worker && this.bitmapMode) {
        let bitmap: ImageBitmap | undefined
        try { bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: height }) }
        catch { this.bitmapMode = false }
        if (generation !== this.generation || this.closed) {
          bitmap?.close()
          this.busy = false
          return
        }
        if (bitmap) {
          this.sample(bitmap, video, now)
          try {
            worker.postMessage({ ...frame, bitmap }, [bitmap])
            this.timer = window.setTimeout(this.onError, 12000)
            return
          } catch {
            bitmap.close()
            this.bitmapMode = false
          }
        }
      }
      const ctx = this.context
      if (!ctx) throw new Error('Camera copy unavailable')
      if (this.canvas.width !== width) this.canvas.width = width
      if (this.canvas.height !== height) this.canvas.height = height
      ctx.drawImage(video, 0, 0, width, height)
      this.sample(this.canvas, video, now)
      if (worker) {
        const { data: pixels } = ctx.getImageData(0, 0, width, height)
        worker.postMessage({ ...frame, pixels, width, height }, [pixels.buffer])
        this.timer = window.setTimeout(this.onError, 12000)
      } else if (this.main) {
        const start = performance.now()
        const data = this.main.detect(this.canvas, now)
        this.busy = false
        this.receive(data, performance.now() - start)
      }
    } catch {
      this.busy = false
      if (!this.closed) this.onError()
    }
  }

  pause() {
    this.generation++
    this.lastVideo = -1
  }

  close() {
    this.closed = true
    this.cancelInit?.()
    clearTimeout(this.timer)
    this.worker?.terminate()
    this.worker = null
    this.main?.close()
    this.main = null
    this.background.reset()
  }
}

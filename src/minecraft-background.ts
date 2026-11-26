import type { PersonMask } from './minecraft-combat.ts'

type Image = { width: number; height: number; data: Uint8ClampedArray }
const maxSide = 360
const backgroundConfidence = 24
const targetConfidence = 40

/** A clean plate in camera coordinates. Mirroring and crop happen at composition time. */
export class BackgroundPlate {
  width = 0
  height = 0
  private seen = new Uint8Array(0)
  private rgb = new Uint8ClampedArray(0)
  private blocked = new Uint8Array(0)
  private unseen = 0
  private revealed = 0
  private image: Uint8ClampedArray | null = null

  reset(width = 0, height = 0) {
    const area = width * height
    this.width = width
    this.height = height
    this.seen = new Uint8Array(area)
    this.rgb = new Uint8ClampedArray(area * 4)
    this.blocked = new Uint8Array(area)
    this.unseen = area
    this.revealed = 0
    this.image = null
  }

  observe(frame: Image, mask: PersonMask) {
    const { width, height, data } = frame
    if (width !== this.width || height !== this.height) this.reset(width, height)
    const area = width * height
    const maskX = (x: number) => Math.min(mask.width - 1, Math.floor((x + .5) * mask.width / width))
    const maskY = (y: number) => Math.min(mask.height - 1, Math.floor((y + .5) * mask.height / height))

    // Exclude a small margin around the silhouette so hair and motion edges cannot leak into the plate.
    for (let y = 0; y < height; y++) {
      const top = maskY(Math.max(0, y - 2)) * mask.width
      const bottom = maskY(Math.min(height - 1, y + 2)) * mask.width
      const middle = maskY(y) * mask.width
      for (let x = 0; x < width; x++) {
        const center = maskX(x)
        const left = maskX(Math.max(0, x - 2)), right = maskX(Math.min(width - 1, x + 2))
        this.blocked[y * width + x] = Number(Math.max(
          mask.pixels[middle + center]!, mask.pixels[top + left]!, mask.pixels[top + right]!,
          mask.pixels[bottom + left]!, mask.pixels[bottom + right]!,
        ) >= backgroundConfidence)
      }
    }

    // A camera pan or large exposure shift invalidates pixels hidden in the old view.
    let compared = 0, changed = 0
    for (let i = 0; i < area; i += 31) {
      if (this.blocked[i] || !this.seen[i]) continue
      compared++
      const offset = i * 4
      const delta = Math.abs(data[offset]! - this.rgb[offset]!) + Math.abs(data[offset + 1]! - this.rgb[offset + 1]!) +
        Math.abs(data[offset + 2]! - this.rgb[offset + 2]!)
      if (delta > 85) changed++
    }
    if (compared > 25 && changed / compared > .51) {
      this.seen.fill(0)
      this.unseen = area
      this.image = null
    }
    for (let i = 0; i < area; i++) {
      if (this.blocked[i]) continue
      if (!this.seen[i]) {
        this.seen[i] = 1
        this.unseen--
        this.revealed++
      }
      const offset = i * 4
      this.rgb[offset] = data[offset]!
      this.rgb[offset + 1] = data[offset + 1]!
      this.rgb[offset + 2] = data[offset + 2]!
      this.rgb[offset + 3] = 255
    }
  }

  rebuild(force = false) {
    if (!this.width || (!force && this.image && this.revealed < this.seen.length * .006)) return null
    const area = this.seen.length
    const output = this.image ?? new Uint8ClampedArray(area * 4)
    output.set(this.rgb)
    if (this.unseen) this.fillUnseen(output)
    this.image = output
    this.revealed = 0
    return output
  }

  private fillUnseen(output: Uint8ClampedArray) {
    const { width, height, seen, rgb } = this
    const directions = [1, -1, width, -width]
    const nearest = directions.map(() => new Int32Array(seen.length).fill(-1))
    for (const [direction, step] of directions.entries()) {
      const horizontal = direction < 2
      const lines = horizontal ? height : width
      const length = horizontal ? width : height
      for (let line = 0; line < lines; line++) {
        const start = horizontal ? line * width : line
        let sample = -1
        let index = start + (step > 0 ? 0 : (length - 1) * -step)
        for (let n = 0; n < length; n++, index += step) {
          if (seen[index]) sample = index
          nearest[direction]![index] = sample
        }
      }
    }

    for (let i = 0; i < seen.length; i++) {
      if (seen[i]) continue
      let r = 0, g = 0, b = 0, weightSum = 0
      for (const [direction, step] of directions.entries()) {
        const edge = nearest[direction]![i]!
        if (edge < 0) continue
        const distance = Math.abs((i - edge) / step)
        const opposite = nearest[direction ^ 1]![i]!
        const agreement = opposite < 0 ? .55 : 1 / (1 + (
          Math.abs(rgb[edge * 4]! - rgb[opposite * 4]!) +
          Math.abs(rgb[edge * 4 + 1]! - rgb[opposite * 4 + 1]!) +
          Math.abs(rgb[edge * 4 + 2]! - rgb[opposite * 4 + 2]!)
        ) / 80)
        // Reflect a narrow band of the real background along the best-aligned axes.
        const offset = Math.min(20, Math.floor(distance * .66))
        const coordinate = direction < 2 ? edge % width : Math.floor(edge / width)
        const extent = direction < 2 ? width : height
        const reflected = coordinate - Math.sign(step) * offset
        const probe = edge - step * offset
        const source = reflected >= 0 && reflected < extent && seen[probe] ? probe : edge
        const weight = (.25 + agreement) / (2 + distance) ** 1.5
        r += weight * rgb[source * 4]!
        g += weight * rgb[source * 4 + 1]!
        b += weight * rgb[source * 4 + 2]!
        weightSum += weight
      }
      const pixel = i * 4
      if (weightSum > 0) {
        output[pixel] = r / weightSum
        output[pixel + 1] = g / weightSum
        output[pixel + 2] = b / weightSum
      } else if (this.unseen < seen.length) {
        // Diagonal-only visibility: propagate from nearby filled cells below.
        continue
      } else {
        output[pixel] = 30
        output[pixel + 1] = 28
        output[pixel + 2] = 34
      }
      output[pixel + 3] = 255
    }
    // Any pixel with no row/column sample can use the nearest completed scanline.
    for (let x = 0; x < width; x++) {
      let from = -1
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4
        if (output[i + 3]) from = i
        else if (from >= 0) output.set(output.subarray(from, from + 4), i)
      }
      from = -1
      for (let y = height - 1; y >= 0; y--) {
        const i = (y * width + x) * 4
        if (output[i + 3]) from = i
        else if (from >= 0) output.set(output.subarray(from, from + 4), i)
      }
    }
  }
}

/** Retain the connected silhouette covering the crosshair, then track its overlap. */
export function selectSilhouette(mask: PersonMask, previous: PersonMask | null): PersonMask {
  const scale = Math.min(1, 264 / Math.max(mask.width, mask.height))
  const width = Math.max(1, Math.round(mask.width * scale))
  const height = Math.max(1, Math.round(mask.height * scale))
  const pixels = new Uint8Array(width * height)
  const eligible = new Uint8Array(pixels.length)
  const queue = new Int32Array(pixels.length)
  let seed = -1
  let best = Infinity
  for (let y = 0; y < height; y++) {
    const sourceRow = Math.floor((y + .5) * mask.height / height) * mask.width
    const v = (y + .5) / height
    const previousRow = previous ? Math.floor(v * previous.height) * previous.width : 0
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width
      const index = y * width + x
      const confidence = mask.pixels[sourceRow + Math.floor(u * mask.width)]!
      eligible[index] = confidence
      if (confidence < 100 || (previous && previous.pixels[previousRow + Math.floor(u * previous.width)]! < 110)) continue
      const distance = (u - .5) ** 2 + (v - .5) ** 2
      if (distance < best) {
        seed = index
        best = distance
      }
    }
  }
  if (seed >= 0) {
    let head = 0, tail = 0
    const enqueue = (index: number) => {
      if (eligible[index]! < targetConfidence) return
      pixels[index] = eligible[index]!
      eligible[index] = 0
      queue[tail++] = index
    }
    enqueue(seed)
    while (head < tail) {
      const i = queue[head++]!
      const x = i % width
      if (x) enqueue(i - 1)
      if (x + 1 < width) enqueue(i + 1)
      if (i >= width) enqueue(i - width)
      if (i + width < pixels.length) enqueue(i + width)
    }
  }
  return { ...mask, pixels, width, height }
}

export class BackgroundCapture {
  private context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  private sampledAt = -Infinity
  private snapshot: { frame: ImageData; timestamp: number } | null = null
  readonly plate = new BackgroundPlate()

  sample(source: CanvasImageSource, width: number, height: number, timestamp: number, force = false) {
    const ctx = this.context
    if (!ctx || (!force && timestamp - this.sampledAt < 140)) return
    const scale = Math.min(1, maxSide / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
    if (ctx.canvas.width !== w) ctx.canvas.width = w
    if (ctx.canvas.height !== h) ctx.canvas.height = h
    ctx.drawImage(source, 0, 0, w, h)
    this.snapshot = { frame: ctx.getImageData(0, 0, w, h), timestamp }
    this.sampledAt = timestamp
  }

  observe(mask: PersonMask) {
    if (this.snapshot?.timestamp !== mask.timestamp) return
    this.plate.observe(this.snapshot.frame, mask)
    this.snapshot = null
  }

  reset() {
    this.sampledAt = -Infinity
    this.snapshot = null
    this.plate.reset()
  }
}

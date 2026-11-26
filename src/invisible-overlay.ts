import type { PersonMask } from './minecraft-combat'
import type { BackgroundPlate } from './minecraft-background'

const alpha = Uint8Array.from({ length: 256 }, (_, index) => {
  const value = Math.min(1, Math.max(0, (index / 255 - .15) / .42))
  return Math.round(value * value * (3 - 2 * value) * 255)
})

/** Paint only the feathered replacement. Native video supplies all unmasked pixels. */
export class InvisibleOverlay {
  private context: CanvasRenderingContext2D | null
  private output: ImageData | null = null
  private background: Uint8ClampedArray | null = null

  constructor(privateCanvas: HTMLCanvasElement) {
    this.context = privateCanvas.getContext('2d')
  }

  render(mask: PersonMask, plate: BackgroundPlate, force: boolean) {
    const ctx = this.context
    if (!ctx || !plate.width) return false
    this.background = plate.rebuild(force || !this.background) ?? this.background
    if (!this.background) return false
    const { width, height } = plate
    if (!this.output || this.output.width !== width || this.output.height !== height) {
      ctx.canvas.width = width
      ctx.canvas.height = height
      this.output = ctx.createImageData(width, height)
    }
    const output = this.output.data
    output.set(this.background)
    for (let y = 0; y < height; y++) {
      const row = Math.floor((y + .5) * mask.height / height) * mask.width
      for (let x = 0; x < width; x++) {
        output[(y * width + x) * 4 + 3] = alpha[mask.pixels[row + Math.floor((x + .5) * mask.width / width)]!]!
      }
    }
    ctx.putImageData(this.output, 0, 0)
    return true
  }

  clear() {
    const ctx = this.context
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    this.background = this.output = null
  }
}

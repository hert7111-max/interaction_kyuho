import * as THREE from 'three'
import { CONFIG } from '../config.js'

const { texture: style, textureSize, faceTextureSize } = CONFIG.character
const array = color => [color.r, color.g, color.b]
const blend = (base, tint, amount) => base.map((channel, i) => channel + (tint[i] - channel) * amount)
const color = (rgb, tone = 1) => {
  const factors = Array.isArray(tone) ? tone : [tone, tone, tone]
  return 'rgb(' + rgb.map((value, i) => Math.max(0, Math.min(255, value * factors[i]))) + ')'
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d'))
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = map.minFilter = THREE.NearestFilter
  map.generateMipmaps = false
  return map
}

function faceTexture(skin) {
  const f = style.face
  return canvasTexture(faceTextureSize, ctx => {
    ctx.scale(faceTextureSize / 64, faceTextureSize / 64)
    const shading = ctx.createLinearGradient(0, 0, 0, 64)
    shading.addColorStop(0, color(skin, .99))
    shading.addColorStop(.63, color(skin, f.cheek))
    shading.addColorStop(1, color(skin, f.jaw))
    ctx.fillStyle = shading
    ctx.fillRect(0, 0, 64, 64)

    const oval = (rgb, x, y, rx, ry) => {
      ctx.fillStyle = color(rgb)
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      const eye = 32 + side * 6.0
      ctx.strokeStyle = color(blend(skin, f.outline, .61))
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.moveTo(eye - 1.73, 23.1)
      ctx.quadraticCurveTo(eye, 21.6, eye + 1.73, 23.1)
      ctx.stroke()

      oval(f.outline, eye, 31.40, 2.75, 6.45)
      oval(f.eyeWhite, eye, 31.27, 2.18, 5.55)
      oval(f.iris, eye + .10, 32.08, 1.64, 4.18)
      oval(f.pupil, eye + .10, 32.08, 1.18, 2.90)
      oval(f.glint, eye - .50, 29.70, .52, 1.00)
      oval(blend(skin, f.blush, f.blushMix), 32 + side * 9.1, 42.3, 2.25, 2.14)
    }

    ctx.strokeStyle = color(f.smile)
    ctx.lineWidth = 1.65
    ctx.beginPath()
    ctx.moveTo(27.75, 44.6)
    ctx.quadraticCurveTo(32, 53.2, 36.25, 44.6)
    ctx.stroke()
  })
}

function materialTexture(base, kind, look, palette) {
  return canvasTexture(textureSize, ctx => {
    ctx.scale(textureSize / 16, textureSize / 16)
    const block = (rgb, tone, x, y, w, h) => {
      ctx.fillStyle = color(rgb, tone)
      ctx.fillRect(x, y, w, h)
    }
    const fabric = look.topBase ? array(look.topBase) : base
    const accent = look.topAccent && array(look.topAccent)
    const isShirt = kind === 'top' || kind === 'sleeves'
    const grain = kind === 'hair' ? style.hairGrain : style.grain
    for (let y = 0; y < 16; y++) {
      const accentRow = isShirt && accent && (
        (look.pattern === 'panel' && y <= (kind === 'sleeves' ? 15 : 5)) ||
        (kind === 'top' && look.pattern === 'band' && y >= 5 && y <= 9)
      )
      const rgb = accentRow ? accent : isShirt ? fabric : base
      for (let x = 0; x < 16; x++) {
        const index = ((x * 7) ^ (y * 11) ^ (x * y)) & 3
        block(rgb, grain[index], x, y, 1, 1)
      }
    }
    if (kind === 'top') {
      for (const x of [3, 5, 10, 12]) block(fabric, style.fold, x, 11 + (x & 1), 1, 2)
      block(fabric, style.fold, 0, 15, 16, 1)
      const depth = look.top === 'sleeveless' ? 4.5 : 2.4
      const neckline = (spread, dip, fill) => {
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.moveTo(8 - spread, 0)
        ctx.lineTo(8 + spread, 0)
        ctx.bezierCurveTo(8 + spread, dip, 8 - spread, dip, 8 - spread, 0)
        ctx.fill()
      }
      neckline(1.9, depth, color(fabric, style.fold))
      neckline(1.5, depth - .8, color(array(palette.skin), .94))
    } else if (kind === 'sleeves') {
      block(look.pattern === 'panel' && accent ? accent : fabric, style.fold, 0, 15, 16, 1)
    } else if (kind === 'bottom') {
      block(base, style.lightFold, 7, 3, 2, 6)
      block(base, style.stitch, 4, 0, 1, 16)
      block(base, style.fold, 11, 0, 1, 16)
      block(base, style.fold, 6, 12, 3, 1)
      block(base, style.stitch, 7, 14, 2, 1)
    } else if (kind === 'hair') {
      for (const x of [1, 4, 7, 10, 13]) {
        block(base, style.hairGrain[0], x, (x * 3) % 7, 1, 5)
        block(base, style.hairGrain[3], x + 1, (x * 3) % 7 + 3, 1, 4)
      }
    } else if (kind === 'shoes') {
      block(style.sole, 1, 0, 13, 16, 2)
      block(style.sole, .66, 0, 15, 16, 1)
      for (const y of [1, 4, 7]) block(style.lace, 1, 7, y, 2, 1)
    }
  })
}

export function makeSubjectMaterials(palette, clippingPlane, appearance = {}) {
  const look = { ...CONFIG.scan.appearance.defaults, ...appearance }
  const pairs = [
    ['skin', array(palette.skin)], ['face', array(palette.skin)], ['hair', array(palette.hair)],
    ['top', array(palette.top)], ['sleeves', array(palette.top)], ['bottom', array(palette.bottom)],
    ['shoes', look.shoeColor ? array(look.shoeColor) : style.shoe],
  ]
  const material = options => new THREE.MeshLambertMaterial({ flatShading: true, clippingPlanes: [clippingPlane], ...options })
  const materials = Object.fromEntries(pairs.map(([name, rgb]) => [name, material({
    map: name === 'face' ? faceTexture(rgb) : materialTexture(rgb, name, look, palette),
  })]))
  const [r, g, b] = blend(array(palette.skin), style.face.blush, style.face.noseMix)
  materials.nose = material({ color: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace) })
  return materials
}

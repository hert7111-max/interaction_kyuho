import { CONFIG } from '../config.js'

export class ScanOverlay {
  constructor(canvas, video) {
    this.ctx = canvas.getContext('2d')
    this.video = video
    this.resize()
  }

  resize() {
    const { ctx } = this
    const canvas = ctx.canvas
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight
    const dpr = Math.min(devicePixelRatio, CONFIG.overlay.maxPixelRatio)
    canvas.width = Math.max(1, Math.round(this.width * dpr))
    canvas.height = Math.max(1, Math.round(this.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  clear() {
    this.handVisible = false
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  projectPoint(point) {
    if (!point) return null
    const { width, height, video } = this
    if (!video.videoWidth || !video.videoHeight) return null
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
    const w = video.videoWidth * scale, h = video.videoHeight * scale
    const x = (1 - point.x) * w + (width - w) / 2
    const y = point.y * h + (height - h) / 2
    if (!(x >= 0 && x < width && y >= 0 && y < height)) return null
    return { x, y, confident: (point.visibility ?? 1) >= CONFIG.scan.minimumVisibility }
  }

  project(landmarks) {
    return landmarks?.slice(0, CONFIG.scan.upperLandmarkCount).map(point => this.projectPoint(point)) ?? []
  }

  drawHand(point) {
    const center = this.projectPoint(point)
    if (!center && !this.handVisible) return
    this.clear()
    if (!center) return
    const { ctx } = this
    const style = CONFIG.overlay
    ctx.save()
    ctx.globalAlpha = style.handMarkerOpacity
    ctx.strokeStyle = CONFIG.colors.hud
    ctx.lineWidth = style.lineWidth
    ctx.beginPath()
    ctx.arc(center.x, center.y, style.handMarkerRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    this.handVisible = true
  }

  transfer(landmarks, destinations, progress) {
    this.clear()
    if (progress >= 1) return
    const { ctx, width, height } = this
    const { transfer: style } = CONFIG.build
    const points = this.project(landmarks)
    const { eyes, shoulders, elbows } = CONFIG.scan.joints
    const pairs = [eyes, shoulders, elbows]
    ctx.save()
    ctx.setLineDash(style.dash)
    ctx.lineDashOffset = -progress * style.travel
    ctx.strokeStyle = CONFIG.colors.hud
    ctx.lineWidth = style.lineWidth
    ctx.globalAlpha = style.opacity * Math.min(1, (1 - progress) / (1 - style.fadesAt))
    for (const [index, target] of destinations.entries()) {
      const pair = pairs[index].map(joint => points[joint]).filter(point => point?.confident)
      const start = pair.length ? pair.reduce((a, b) => a.x < b.x ? a : b) : {
        x: width * style.fallbackX, y: height * (.5 + (index - 1) * style.fallbackSpread),
      }
      const x = Math.min(width, Math.max(0, start.x))
      const y = Math.min(height, Math.max(0, start.y))
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(
        x + (target.x - x) * .3, y - Math.abs(x - target.x) * style.bend,
        x + (target.x - x) * .7, target.y - Math.abs(x - target.x) * style.bend,
        target.x, target.y,
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  draw(landmarks, connections, progress) {
    this.clear()
    const { ctx, width, height } = this
    const { overlay: style, colors } = CONFIG
    const points = this.project(landmarks)
    const visible = points.filter(point => point?.confident)
    if (!visible.length) return
    const pad = style.boxPadding
    const left = Math.max(pad, Math.min(...visible.map(point => point.x)) - pad)
    const top = Math.max(pad, Math.min(...visible.map(point => point.y)) - pad)
    const right = Math.min(width - pad, Math.max(...visible.map(point => point.x)) + pad)
    const bottom = Math.min(height - pad, Math.max(...visible.map(point => point.y)) + pad)

    if (right > left && bottom > top) {
      const corner = Math.min(style.cornerSize, (right - left) / 2, (bottom - top) / 2)
      ctx.strokeStyle = colors.hud
      ctx.lineWidth = style.lineWidth
      ctx.globalAlpha = style.lineOpacity
      ctx.beginPath()
      for (const [x, y, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
        ctx.moveTo(x, y + corner * dy)
        ctx.lineTo(x, y)
        ctx.lineTo(x + corner * dx, y)
      }
      const sweep = 1 - Math.abs(progress * 2 - 1)
      const scanY = top + (bottom - top) * sweep
      ctx.moveTo(left, scanY)
      ctx.lineTo(right, scanY)
      ctx.stroke()
    }

    ctx.strokeStyle = colors.spline
    ctx.lineWidth = style.splineWidth
    ctx.globalAlpha = style.splineOpacity
    ctx.beginPath()
    for (const { start, end } of connections) {
      const a = points[start], b = points[end]
      if (!a?.confident || !b?.confident) continue
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo(
        (a.x + b.x) / 2 - (b.y - a.y) * style.splineBend,
        (a.y + b.y) / 2 + (b.x - a.x) * style.splineBend, b.x, b.y,
      )
    }
    ctx.stroke()
    ctx.fillStyle = colors.landmark
    for (const point of points) {
      if (!point) continue
      ctx.globalAlpha = point.confident ? 1 : style.weakMarkerOpacity
      ctx.beginPath()
      ctx.arc(point.x, point.y, style.markerRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

import './style.css'

const sparkle = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" stroke="currentColor" stroke-width="1.2"/></svg>'
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="night" aria-label="인터랙티브 불꽃놀이">
  <canvas id="stars" aria-hidden="true"></canvas>
  <div class="haze haze-one"></div><div class="haze haze-two"></div>
  <header class="header">
    <a class="wordmark" href="./" aria-label="밤하늘 캔버스 홈">${sparkle}<span>NIGHT CANVAS<span class="wordmark-sub">A LITTLE WONDER, AT YOUR FINGERTIPS</span></span></a>
    <button class="fullscreen" type="button" aria-label="전체 화면으로 보기" title="전체 화면"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span>전체 화면</span></button>
  </header>
  <div class="intro" aria-hidden="true"><span class="eyebrow">LET YOUR IDEAS LIGHT UP THE SKY</span></div>
  <div class="cloud-title">
    <svg class="cloud-filters" width="0" height="0" aria-hidden="true"><defs>
      <filter id="cloud" x="-15%" y="-60%" width="130%" height="220%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".019 .065" numOctaves="3" seed="8" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="drift"/>
        <feGaussianBlur in="drift" stdDeviation="1.1" result="soft"/>
        <feGaussianBlur in="drift" stdDeviation="9" result="mist"/>
        <feMerge><feMergeNode in="mist"/><feMergeNode in="soft"/></feMerge>
      </filter>
    </defs></svg>
    <h1>바이브코딩 워크숍</h1><p>상상을 펼치면, 밤하늘이 빛나요.</p>
  </div>
  <canvas id="fireworks" tabindex="0" role="application" aria-label="불꽃놀이 캔버스. 클릭하거나 터치해 폭죽을 터뜨리세요. 오래 누르면 커지고, 드래그 후 놓으면 경로를 따라 터집니다. 키보드는 방향키로 위치를 옮기고 스페이스를 누른 뒤 놓으세요."></canvas>
  <div class="horizon" aria-hidden="true"></div>
  <footer class="footer">
    <div class="invitation"><span class="live-dot"></span>빈 하늘을 눌러, 나만의 불꽃을 피워보세요</div>
    <div class="guide" aria-label="사용 방법">
      <div class="gesture"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 3 11 10-6 .8L9.5 20 7 3Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m16 3 1 2m4 2-2 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>가볍게 클릭<small>작은 반짝임</small></span></div>
      <div class="divider"></div>
      <div class="gesture"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>꾹 누르기<small>더 커지는 설렘</small></span></div>
      <div class="divider"></div>
      <div class="gesture"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17c2-13 6 9 10-3s6-8 7-10m-4 0h4v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>드래그 후 놓기<small>선을 따라 피는 불꽃</small></span></div>
    </div>
    <div class="footnote"><span>MADE OF IDEAS & STARDUST</span><span class="palette"><i></i><i></i><i></i><i></i><i></i></span><span>하늘은 당신의 캔버스</span></div>
  </footer>
  <p class="sr-only" id="announcement" role="status" aria-live="polite"></p>
</main>`

const canvas = document.querySelector<HTMLCanvasElement>('#fireworks')!
const ctx = canvas.getContext('2d')!
const starCanvas = document.querySelector<HTMLCanvasElement>('#stars')!
const starCtx = starCanvas.getContext('2d')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const colors = ['#ffbb83', '#b8adff', '#7bdcde', '#f29ac8', '#a8c7ff', '#f8dc8b']
type Point = { x: number; y: number }
type Gesture = { start: number; points: Point[]; current: Point; hue: number; distance: number }
type Particle = Point & { vx: number; vy: number; life: number; maxLife: number; color: number; size: number; tail: Point[]; shimmer: number }
type Burst = Point & { at: number; power: number; hue: number }
type Flash = Point & { life: number; radius: number; color: number }
let width = innerWidth, height = innerHeight
let stars: { x: number; y: number; radius: number; alpha: number; phase: number }[] = []
const gestures = new Map<number, Gesture>()
let particles: Particle[] = []
let queue: Burst[] = []
let flashes: Flash[] = []
let lastFrame = performance.now()
let keyboardPoint = { x: width / 2, y: height * .56 }
let keyboardVisible = false
let burstCount = 0
const random = (min: number, max: number) => min + Math.random() * (max - min)
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const powerFor = (duration: number) => .62 + Math.min(duration / 2200, 1) * 1.65
const sprites = colors.map(color => {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 40
  const context = sprite.getContext('2d')!
  const glow = context.createRadialGradient(20, 20, 0, 20, 20, 20)
  glow.addColorStop(0, '#fff'); glow.addColorStop(.12, color); glow.addColorStop(.3, color + '70'); glow.addColorStop(1, color + '00')
  context.fillStyle = glow; context.fillRect(0, 0, 40, 40)
  return sprite
})

function resize() {
  width = innerWidth; height = innerHeight
  const ratio = Math.min(devicePixelRatio || 1, 2)
  for (const surface of [canvas, starCanvas]) {
    surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio)
    surface.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  stars = Array.from({ length: Math.min(380, Math.round(width * height / 4000)) }, () => ({ x: random(0, width), y: random(0, height), radius: random(.35, 1.25), alpha: random(.12, .65), phase: random(0, Math.PI * 2) }))
  keyboardPoint = { x: width / 2, y: height * .56 }
  gestures.clear()
}

function burst(x: number, y: number, power: number, hue: number) {
  const shape = Math.floor(random(0, 6))
  const amount = Math.round((reducedMotion.matches ? 28 : 100) * Math.sqrt(power))
  const scale = Math.min(width, height) / 780
  const speed = (1.1 + power * .64) * Math.max(.65, Math.min(scale, 1.25))
  const rotation = random(0, Math.PI * 2)
  for (let i = 0; i < amount; i++) {
    const t = (i / amount) * Math.PI * 2
    let vx: number, vy: number
    const angle = t + rotation
    if (shape === 1) {
      // A heart traced with sparks.
      vx = 16 * Math.sin(t) ** 3 / 5.2
      vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 5.2
    } else if (shape === 2) {
      // Interpolate the outline of a five-point star.
      const sector = (i / amount * 10) % 1
      const a = Math.floor(i / amount * 10) * Math.PI / 5 - Math.PI / 2 + rotation
      const r1 = Math.floor(i / amount * 10) % 2 === 0 ? 3.6 : 1.55
      const r2 = r1 === 3.6 ? 1.55 : 3.6
      vx = Math.cos(a) * r1 * (1 - sector) + Math.cos(a + Math.PI / 5) * r2 * sector
      vy = Math.sin(a) * r1 * (1 - sector) + Math.sin(a + Math.PI / 5) * r2 * sector
    } else {
      const radius = shape === 3 ? 3.4 : shape === 4 ? (i % 2 ? 3.7 : 1.8) : random(.6, 3.8)
      vx = Math.cos(angle) * radius
      vy = Math.sin(angle) * radius * (shape === 5 ? .58 : 1)
    }
    const life = random(65, 110) * (reducedMotion.matches ? .6 : 1)
    particles.push({ x, y, vx: vx * speed, vy: vy * speed, life, maxLife: life, color: Math.random() < .16 ? (hue + 1) % colors.length : hue, size: random(.9, 1.8), tail: [], shimmer: Math.random() })
  }
  if (particles.length > 4200) particles.splice(0, particles.length - 4200)
  flashes.push({ x, y, life: 1, radius: 52 * power, color: hue })
  burstCount++
}

function start(id: number, point: Point) {
  gestures.set(id, { start: performance.now(), points: [point], current: point, hue: Math.floor(random(0, colors.length)), distance: 0 })
}
function move(id: number, point: Point) {
  const gesture = gestures.get(id)
  if (!gesture) return
  gesture.current = point
  const previous = gesture.points[gesture.points.length - 1]!
  if (distance(point, previous) >= 3) {
    gesture.distance += distance(point, previous)
    gesture.points.push(point)
    if (gesture.points.length > 3000) gesture.points = gesture.points.filter((_, i) => i % 2 === 0 || i === gesture.points.length - 1)
  }
}
function release(id: number) {
  const gesture = gestures.get(id)
  if (!gesture) return
  gestures.delete(id)
  const now = performance.now()
  const power = powerFor(now - gesture.start)
  if (gesture.distance < 16) {
    burst(gesture.current.x, gesture.current.y, power, gesture.hue)
  } else {
    const points = [...gesture.points]
    if (distance(points[points.length - 1]!, gesture.current) > .1) points.push(gesture.current)
    let total = 0
    const lengths = points.map((point, i) => { if (i) total += distance(points[i - 1]!, point); return total })
    const count = Math.min(44, Math.max(2, Math.ceil(total / 48) + 1))
    let segment = 1
    for (let i = 0; i < count; i++) {
      const target = total * i / (count - 1)
      while (segment < points.length - 1 && lengths[segment]! < target) segment++
      const a = points[segment - 1]!, b = points[segment]!
      const fraction = (target - lengths[segment - 1]!) / Math.max(.01, lengths[segment]! - lengths[segment - 1]!)
      queue.push({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, power: power * .78, at: now + i * 68, hue: (gesture.hue + Math.floor(i / 3)) % colors.length })
    }
    if (queue.length > 180) queue.splice(0, queue.length - 180)
  }
  document.querySelector('#announcement')!.textContent = '밤하늘에 불꽃이 피어납니다.'
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault(); keyboardVisible = false
  canvas.setPointerCapture(event.pointerId)
  start(event.pointerId, { x: event.clientX, y: event.clientY })
})
canvas.addEventListener('pointermove', event => {
  for (const sample of event.getCoalescedEvents?.() ?? [event]) move(event.pointerId, { x: sample.clientX, y: sample.clientY })
  move(event.pointerId, { x: event.clientX, y: event.clientY })
})
canvas.addEventListener('pointerup', event => { move(event.pointerId, { x: event.clientX, y: event.clientY }); release(event.pointerId) })
canvas.addEventListener('pointercancel', event => gestures.delete(event.pointerId))
canvas.addEventListener('lostpointercapture', event => gestures.delete(event.pointerId))
canvas.addEventListener('contextmenu', event => event.preventDefault())
canvas.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault()
  keyboardVisible = true
  if (event.key === ' ' && !event.repeat) start(-1, { ...keyboardPoint })
  if (event.key === 'ArrowLeft') keyboardPoint.x = Math.max(20, keyboardPoint.x - 20)
  if (event.key === 'ArrowRight') keyboardPoint.x = Math.min(width - 20, keyboardPoint.x + 20)
  if (event.key === 'ArrowUp') keyboardPoint.y = Math.max(20, keyboardPoint.y - 20)
  if (event.key === 'ArrowDown') keyboardPoint.y = Math.min(height - 20, keyboardPoint.y + 20)
  move(-1, { ...keyboardPoint })
})
canvas.addEventListener('keyup', event => { if (event.key === ' ') { event.preventDefault(); release(-1) } })
canvas.addEventListener('blur', () => { gestures.delete(-1); keyboardVisible = false })
addEventListener('blur', () => gestures.clear())
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { gestures.clear(); queue = []; particles = []; flashes = [] }
  lastFrame = performance.now()
})
addEventListener('resize', resize)
const fullscreenButton = document.querySelector<HTMLButtonElement>('.fullscreen')!
if (!document.fullscreenEnabled) fullscreenButton.hidden = true
fullscreenButton.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { /* Embedded previews can restrict fullscreen. */ }
})
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? '전체 화면 나가기' : '전체 화면'
  fullscreenButton.querySelector('span')!.textContent = label
  fullscreenButton.setAttribute('aria-label', label)
})

function draw(time: number) {
  const dt = Math.min(2.2, (time - lastFrame) / 16.667)
  lastFrame = time
  starCtx.clearRect(0, 0, width, height)
  for (const star of stars) {
    starCtx.globalAlpha = star.alpha * (reducedMotion.matches ? .8 : .65 + .35 * Math.sin(time * .0006 + star.phase))
    starCtx.fillStyle = '#c7d6f6'
    starCtx.beginPath(); starCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); starCtx.fill()
    if (star.radius > 1.18) { starCtx.globalAlpha *= .3; starCtx.fillRect(star.x - 3.2, star.y - .3, 6.4, .6); starCtx.fillRect(star.x - .3, star.y - 3.2, .6, 6.4) }
  }
  starCtx.globalAlpha = 1
  ctx.clearRect(0, 0, width, height)
  for (const item of queue) if (item.at <= time) burst(item.x, item.y, item.power, item.hue)
  queue = queue.filter(item => item.at > time)
  ctx.globalCompositeOperation = 'lighter'
  for (const flash of flashes) {
    flash.life -= .065 * dt
    if (flash.life <= 0) continue
    ctx.globalAlpha = flash.life * .3
    ctx.drawImage(sprites[flash.color]!, flash.x - flash.radius, flash.y - flash.radius, flash.radius * 2, flash.radius * 2)
  }
  flashes = flashes.filter(flash => flash.life > 0)
  for (const particle of particles) {
    particle.tail.unshift({ x: particle.x, y: particle.y })
    if (particle.tail.length > 7) particle.tail.pop()
    particle.x += particle.vx * dt; particle.y += particle.vy * dt
    particle.vx *= Math.pow(.987, dt); particle.vy = particle.vy * Math.pow(.987, dt) + .025 * dt
    particle.life -= dt
    const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife * 1.8))
    const flicker = particle.life < 30 ? .6 + .4 * Math.sin(time * .025 + particle.shimmer * 40) : 1
    ctx.strokeStyle = colors[particle.color]!
    ctx.lineWidth = particle.size * .7; ctx.globalAlpha = alpha * .42 * flicker
    ctx.beginPath(); ctx.moveTo(particle.x, particle.y)
    for (const point of particle.tail) ctx.lineTo(point.x, point.y)
    ctx.stroke(); ctx.globalAlpha = alpha * flicker
    const size = particle.size * 7
    ctx.drawImage(sprites[particle.color]!, particle.x - size / 2, particle.y - size / 2, size, size)
  }
  particles = particles.filter(particle => particle.life > 0)
  ctx.globalCompositeOperation = 'source-over'
  for (const gesture of gestures.values()) {
    const charge = Math.min((time - gesture.start) / 2200, 1)
    ctx.strokeStyle = colors[gesture.hue]!; ctx.lineWidth = 1; ctx.globalAlpha = .3
    ctx.setLineDash([2, 7]); ctx.beginPath()
    gesture.points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
    ctx.lineTo(gesture.current.x, gesture.current.y); ctx.stroke(); ctx.setLineDash([])
    const radius = 14 + charge * 26
    ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(gesture.current.x, gesture.current.y, radius, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = .9; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(gesture.current.x, gesture.current.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke()
    ctx.globalAlpha = .85; ctx.drawImage(sprites[gesture.hue]!, gesture.current.x - 18, gesture.current.y - 18, 36, 36)
  }
  if (keyboardVisible && !gestures.has(-1)) {
    ctx.globalAlpha = .7; ctx.strokeStyle = '#d9d8ff'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(keyboardPoint.x, keyboardPoint.y, 11, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
  requestAnimationFrame(draw)
}
resize()
requestAnimationFrame(draw)
// A quiet opening flourish, leaving the rest of the sky to the visitor.
if (!reducedMotion.matches) {
  const opening = performance.now() + 650
  queue.push({ x: width * .23, y: height * .55, at: opening, power: .8, hue: 0 })
  queue.push({ x: width * .77, y: height * .43, at: opening + 460, power: .95, hue: 1 })
}
// Read-only diagnostics for interaction verification.
Object.defineProperty(window, '__nightCanvas', { get: () => ({ particles: particles.length, queued: queue.length, activePointers: gestures.size, bursts: burstCount }) })

import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="poster" aria-label="고양이 이모티콘 놀이터">
  <header class="header">
    <span class="edition">PLAYGROUND 002</span>
    <span class="club">THE GOOD IDEAS CLUB</span>
    <button class="fullscreen" type="button" aria-label="전체 화면으로 보기" title="전체 화면"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>전체 화면</span></button>
  </header>
  <div class="poster-content">
    <p class="eyebrow">A LITTLE CURIOSITY. A LOT OF CATS.</p>
    <h1 aria-label="VIBE CODING WORKSHOP">
      <svg class="title-desktop" viewBox="0 0 1000 310" role="presentation" aria-hidden="true"><text x="12" y="143" textLength="976" lengthAdjust="spacingAndGlyphs">VIBE CODING</text><text x="12" y="293" textLength="976" lengthAdjust="spacingAndGlyphs">WORKSHOP</text></svg>
      <svg class="title-mobile" viewBox="0 0 1000 650" role="presentation" aria-hidden="true"><text x="18" y="202" textLength="964" lengthAdjust="spacingAndGlyphs">VIBE</text><text x="18" y="412" textLength="964" lengthAdjust="spacingAndGlyphs">CODING</text><text x="18" y="622" textLength="964" lengthAdjust="spacingAndGlyphs">WORKSHOP</text></svg>
    </h1>
    <p class="tagline">BIG IDEAS. LITTLE PAWS.</p>
  </div>
  <canvas id="cats" tabindex="0" role="application" aria-label="고양이 캔버스. 클릭하거나 터치하면 고양이 이모티콘이 터집니다. 오래 누르면 더 커지고, 드래그 후 놓으면 경로를 따라 터집니다. 키보드는 방향키로 위치를 옮기고 스페이스를 누른 뒤 놓으세요."></canvas>
  <footer class="footer">
    <p class="invitation">어디든 눌러보세요. 귀여움이 터질 거예요.</p>
    <div class="guide" aria-label="사용 방법">
      <div class="gesture"><span class="gesture-number">01</span><div><strong>CLICK</strong><span>톡 누르면 고양이 팡!</span></div></div>
      <div class="gesture"><span class="gesture-number">02</span><div><strong>HOLD</strong><span>꾹 누르면 더 크게</span></div></div>
      <div class="gesture"><span class="gesture-number">03</span><div><strong>DRAG & RELEASE</strong><span>선을 따라 냥냥냥</span></div></div>
    </div>
    <div class="footnote"><span>LESS SERIOUS. MORE MEOW.</span><span>CLICK ANYWHERE & MAKE IT MEOW ↗</span></div>
  </footer>
  <p class="sr-only" id="announcement" role="status" aria-live="polite"></p>
</main>`

const canvas = document.querySelector<HTMLCanvasElement>('#cats')!
const ctx = canvas.getContext('2d')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const colors = ['#fa3009', '#d62912', '#e15c2b', '#c93624', '#f44e20', '#ab3a20']
const cats = ['😺', '😸', '😻', '😽', '😼', '🙀', '😹', '🐱']
type Point = { x: number; y: number }
type Gesture = { start: number; points: Point[]; current: Point; hue: number; distance: number }
type Particle = Point & { vx: number; vy: number; life: number; maxLife: number; color: number; size: number; angle: number; spin: number; sprite: number }
type Burst = Point & { at: number; power: number; hue: number }
type Flash = Point & { life: number; radius: number; color: number }
let width = innerWidth, height = innerHeight
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
const sprites = cats.map(emoji => {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 128
  const context = sprite.getContext('2d')!
  context.font = '88px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  context.textAlign = 'center'; context.textBaseline = 'middle'
  context.fillText(emoji, 64, 68)
  return sprite
})

function resize() {
  width = innerWidth; height = innerHeight
  const ratio = Math.min(devicePixelRatio || 1, 2)
  for (const surface of [canvas]) {
    surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio)
    surface.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  keyboardPoint = { x: width / 2, y: height * .56 }
  gestures.clear()
}

function burst(x: number, y: number, power: number, hue: number) {
  const shape = Math.floor(random(0, 6))
  const amount = Math.round((reducedMotion.matches ? 9 : 24) * Math.sqrt(power))
  const scale = Math.min(width, height) / 780
  const speed = (1.2 + power * 1.4) * Math.max(.65, Math.min(scale, 1.25))
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
    const life = random(74, 110) * (reducedMotion.matches ? .6 : 1)
    particles.push({ x, y, vx: vx * speed, vy: vy * speed, life, maxLife: life, color: hue, size: random(26, 40) * Math.sqrt(power) * Math.max(.75, Math.min(scale, 1)), angle: random(-.4, .4), spin: random(-.035, .035), sprite: Math.floor(random(0, cats.length)) })
  }
  if (particles.length > 480) particles.splice(0, particles.length - 480)
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
  document.querySelector('#announcement')!.textContent = '귀여운 고양이들이 튀어나옵니다.'
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
  ctx.clearRect(0, 0, width, height)
  for (const item of queue) if (item.at <= time) burst(item.x, item.y, item.power, item.hue)
  queue = queue.filter(item => item.at > time)
  for (const flash of flashes) {
    flash.life -= .065 * dt
    if (flash.life <= 0) continue
    ctx.globalAlpha = flash.life * .32
    ctx.strokeStyle = colors[flash.color]!
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.arc(flash.x, flash.y, flash.radius * (1.1 - flash.life), 0, Math.PI * 2); ctx.stroke()
  }
  flashes = flashes.filter(flash => flash.life > 0)
  for (const particle of particles) {
    particle.x += particle.vx * dt; particle.y += particle.vy * dt
    particle.vx *= Math.pow(.987, dt)
    particle.vy = particle.vy * Math.pow(.987, dt) + .055 * dt
    particle.angle += particle.spin * dt
    particle.life -= dt
    const alpha = Math.max(0, Math.min(1, particle.life / 26))
    const appear = Math.min(1, (particle.maxLife - particle.life) / 5)
    const size = particle.size * (.45 + .55 * appear)
    ctx.save(); ctx.globalAlpha = alpha
    ctx.translate(particle.x, particle.y); ctx.rotate(particle.angle)
    ctx.drawImage(sprites[particle.sprite]!, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
  particles = particles.filter(particle => particle.life > 0)
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
    ctx.globalAlpha = 1
    const previewSize = 25 + charge * 17
    ctx.drawImage(sprites[gesture.hue % cats.length]!, gesture.current.x - previewSize / 2, gesture.current.y - previewSize / 2, previewSize, previewSize)
  }
  if (keyboardVisible && !gestures.has(-1)) {
    ctx.globalAlpha = .7; ctx.strokeStyle = '#fa3009'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(keyboardPoint.x, keyboardPoint.y, 11, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
  requestAnimationFrame(draw)
}
resize()
requestAnimationFrame(draw)
// A quiet opening flourish, leaving the rest of the poster to the visitor.
if (!reducedMotion.matches) {
  const opening = performance.now() + 650
  queue.push({ x: width * .15, y: height * .65, at: opening, power: .8, hue: 0 })
  queue.push({ x: width * .85, y: height * .58, at: opening + 460, power: .95, hue: 1 })
}
// Read-only diagnostics for interaction verification.
Object.defineProperty(window, '__catCanvas', { get: () => ({ particles: particles.length, queued: queue.length, activePointers: gestures.size, bursts: burstCount }) })

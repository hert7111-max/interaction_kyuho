import './style.css'

const soundIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="sound-cross" d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="playground">
  <canvas id="bubbles" tabindex="0" role="application" aria-label="빨간 뽁뽁이 놀이터. 클릭, 터치하거나 누른 채 드래그해 터뜨리세요. 키보드는 방향키로 이동하고 스페이스 또는 엔터로 터뜨립니다."></canvas>
  <header class="header">
    <div class="brand"><h1>뽁<span>.</span></h1><span class="brand-note">LITTLE POP, BIG RELIEF.</span></div>
    <p class="header-note">아무 생각 없이, 마음껏.</p>
    <div class="controls">
      <button id="sound" class="icon-button" type="button" aria-label="소리 끄기" aria-pressed="true" title="소리 끄기">${soundIcon}</button>
      <button id="reset" class="icon-button" type="button" aria-label="모두 다시 부풀리기" title="모두 다시 부풀리기"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7M4 4v6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
  </header>
  <footer class="footer">
    <span class="regrow"><i></i>다시 부푸는 중에도, 잠깐 쉬어가요.</span>
    <p class="instruction"><span class="mouse-icon">↗</span> 클릭 · 터치 · 드래그 <span class="divider"></span><span class="instruction-light">작은 뽁, 가벼운 마음</span></p>
    <div class="counter"><span id="count">000</span><span class="count-label">POPS</span></div>
  </footer>
  <span class="sr-only" id="announcement" role="status" aria-live="polite"></span>
</main>`

const canvas = document.querySelector<HTMLCanvasElement>('#bubbles')!
const ctx = canvas.getContext('2d')!
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!
const countElement = document.querySelector('#count')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
type Point = { x: number; y: number }
type Bubble = Point & { radius: number; poppedAt: number; delay: number; face: number; phase: number }
type Drop = Point & { vx: number; vy: number; radius: number; born: number; duration: number; heart: boolean; color: string; rotation: number }
type PopLabel = Point & { born: number; text: string; rotation: number }
let width = innerWidth, height = innerHeight
let bubbles: Bubble[] = []
let drops: Drop[] = []
let labels: PopLabel[] = []
let popCount = 0
let muted = false
let hover: Point | null = null
let keyboardIndex = 0
let keyboardVisible = false
let lastFrame = performance.now()
const pointers = new Map<number, Point>()
const random = (a: number, b: number) => a + Math.random() * (b - a)
const TAU = Math.PI * 2
const REINFLATE_MS = 3400
let audio: AudioContext | null = null
let output: DynamicsCompressorNode | null = null
let sounds: AudioBuffer[] = []
let voices = 0
const soundPlays = [0, 0, 0]

// Three original pop sounds, generated locally: crisp, squishy, and bubbly.
function prepareSound() {
  if (muted) return
  try {
    if (!audio) {
      audio = new AudioContext()
      output = audio.createDynamicsCompressor()
      output.threshold.value = -16; output.ratio.value = 8
      const volume = audio.createGain(); volume.gain.value = .48
      output.connect(volume); volume.connect(audio.destination)
      sounds = [0, 1, 2].map(kind => {
        const duration = [.16, .23, .3][kind]!
        const buffer = audio!.createBuffer(1, Math.ceil(audio!.sampleRate * duration), audio!.sampleRate)
        const data = buffer.getChannelData(0)
        let phase = 0, filtered = 0
        for (let i = 0; i < data.length; i++) {
          const t = i / audio!.sampleRate
          const noise = Math.random() * 2 - 1
          filtered = filtered * .67 + noise * .33
          const frequency = kind === 0 ? 75 + 700 * Math.exp(-t * 60) : kind === 1 ? 55 + 420 * Math.exp(-t * 27) : 100 + 930 * Math.exp(-t * 22)
          phase += TAU * frequency / audio!.sampleRate
          const attack = Math.min(1, t / .002)
          const envelope = Math.exp(-t * [36, 23, 20][kind]!) * attack
          const body = Math.sin(phase) * (kind === 1 ? .84 : .68)
          const snap = (kind === 0 ? noise : filtered) * Math.exp(-t * 95) * .45
          const bubble = kind === 2 ? Math.sin(phase * 1.52) * .18 * Math.exp(-t * 24) : 0
          data[i] = Math.tanh((body + snap + bubble) * 1.35) * envelope * .8
        }
        return buffer
      })
    }
    if (audio.state === 'suspended') void audio.resume().catch(() => {})
  } catch { /* Visual interaction remains available without audio support. */ }
}
function playPop() {
  if (muted || !audio || !output || !sounds.length || voices >= 24) return
  const kind = Math.floor(Math.random() * 3)
  const voice = audio.createBufferSource()
  voice.buffer = sounds[kind]!
  voice.connect(output)
  voices++; soundPlays[kind]++
  voice.onended = () => { voices--; voice.disconnect() }
  voice.start()
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill()
}
// Pre-render the glossy surface so even a screen full of bubbles stays light.
const sprites = Array.from({ length: 4 }, (_, face) => {
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 240
  const c = sprite.getContext('2d')!
  c.translate(120, 120)
  ellipse(c, 0, 9, 92, 88, '#35050b')
  const edge = c.createRadialGradient(-20, -33, 5, 0, 0, 94)
  edge.addColorStop(0, '#ff7277'); edge.addColorStop(.35, '#ff3447'); edge.addColorStop(.72, '#e61632'); edge.addColorStop(.94, '#990d25'); edge.addColorStop(1, '#ff4255')
  c.fillStyle = edge; c.beginPath(); c.arc(0, 0, 90, 0, TAU); c.fill()
  const shine = c.createRadialGradient(-27, -40, 0, -20, -27, 60)
  shine.addColorStop(0, '#ffc1bc8c'); shine.addColorStop(.6, '#ffafaa18'); shine.addColorStop(1, '#ff9c9c00')
  c.fillStyle = shine; c.beginPath(); c.arc(0, 0, 88, 0, TAU); c.fill()
  c.save(); c.translate(-30, -47); c.rotate(-.5)
  ellipse(c, 0, 0, 23, 10, '#ffe9dfb8'); ellipse(c, 33, -1, 5, 4, '#ffe9df80'); c.restore()
  c.strokeStyle = '#ff6c7777'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 82, .2, 1.4); c.stroke()
  // Tiny cocoa eyes, rosy cheeks, and four contented expressions.
  ellipse(c, -31, 22, 10, 5.5, '#ff92916b'); ellipse(c, 31, 22, 10, 5.5, '#ff92916b')
  c.strokeStyle = '#550b1d'; c.fillStyle = '#550b1d'; c.lineWidth = 4.4; c.lineCap = 'round'
  for (const x of [-20, 20]) {
    if (face === 1 || (face === 3 && x > 0)) { c.beginPath(); c.moveTo(x - 5, 13); c.quadraticCurveTo(x, 6, x + 5, 13); c.stroke() }
    else ellipse(c, x, 12, 3.8, 5.7, '#550b1d')
  }
  if (face === 2) ellipse(c, 0, 27, 4.2, 5.5, '#550b1d')
  else { c.beginPath(); c.moveTo(-7, 26); c.quadraticCurveTo(0, 35, 7, 26); c.stroke() }
  return sprite
})

function resize() {
  width = innerWidth; height = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const columns = Math.max(3, Math.round(width / (width < 600 ? 83 : 112)))
  const gapX = width / columns
  const top = width < 600 ? 100 : 124
  const bottom = width < 600 ? 100 : 102
  const available = Math.max(60, height - top - bottom)
  const rows = Math.max(1, Math.round(available / gapX))
  const gapY = available / rows
  const radius = Math.min(gapX, gapY) * .355
  const previous = bubbles
  bubbles = Array.from({ length: columns * rows }, (_, i) => ({ x: gapX * (i % columns + .5), y: top + gapY * (Math.floor(i / columns) + .5), radius, poppedAt: previous[i]?.poppedAt ?? -Infinity, delay: previous[i]?.delay ?? 1400, face: previous[i]?.face ?? Math.floor(random(0, 4)), phase: i * 1.76 }))
  keyboardIndex = Math.min(keyboardIndex, bubbles.length - 1)
  pointers.clear(); hover = null
}
function inflation(bubble: Bubble, now: number) {
  const progress = Math.max(0, Math.min(1, (now - bubble.poppedAt - bubble.delay) / REINFLATE_MS))
  return progress * progress * (3 - 2 * progress)
}
function pop(bubble: Bubble, now: number) {
  if (inflation(bubble, now) < .96) return
  bubble.poppedAt = now; bubble.delay = random(1100, 1700)
  popCount++; countElement.textContent = String(popCount).padStart(3, '0')
  playPop()
  const amount = reducedMotion.matches ? 5 : 17
  for (let i = 0; i < amount; i++) {
    const angle = TAU * i / amount + random(-.18, .18)
    const speed = random(70, 230) * bubble.radius / 36
    drops.push({ x: bubble.x, y: bubble.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 28, radius: random(2.8, 7), born: now, duration: random(400, 780), heart: i % 7 === 0, color: ['#ff2847', '#ff4a61', '#bb1031', '#ff7b8e'][i % 4]!, rotation: random(-.8, .8) })
  }
  if (drops.length > 700) drops.splice(0, drops.length - 700)
  labels.push({ x: bubble.x, y: bubble.y - bubble.radius * .3, born: now, text: ['뽁!', '팡!', '뽀독!'][Math.floor(random(0, 3))]!, rotation: random(-.2, .2) })
  if (labels.length > 32) labels.shift()
}
function popPath(from: Point, to: Point) {
  const dx = to.x - from.x, dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  const now = performance.now()
  for (const bubble of bubbles) {
    const t = lengthSquared ? Math.max(0, Math.min(1, ((bubble.x - from.x) * dx + (bubble.y - from.y) * dy) / lengthSquared)) : 0
    const distance = Math.hypot(bubble.x - from.x - t * dx, bubble.y - from.y - t * dy)
    if (distance <= bubble.radius * 1.08) pop(bubble, now)
  }
}
canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault(); prepareSound(); keyboardVisible = false
  canvas.setPointerCapture(event.pointerId)
  const point = { x: event.clientX, y: event.clientY }
  pointers.set(event.pointerId, point); popPath(point, point)
})
canvas.addEventListener('pointermove', event => {
  hover = event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null
  const previous = pointers.get(event.pointerId)
  if (!previous) return
  const samples = event.getCoalescedEvents?.() ?? []
  let from = previous
  for (const sample of [...samples, event]) {
    const to = { x: sample.clientX, y: sample.clientY }; popPath(from, to); from = to
  }
  pointers.set(event.pointerId, from)
})
canvas.addEventListener('pointerup', event => {
  const previous = pointers.get(event.pointerId)
  if (previous) popPath(previous, { x: event.clientX, y: event.clientY })
  pointers.delete(event.pointerId)
})
for (const name of ['pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(name, event => pointers.delete(event.pointerId))
canvas.addEventListener('pointerleave', () => { hover = null })
canvas.addEventListener('contextmenu', event => event.preventDefault())
canvas.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) return
  event.preventDefault(); keyboardVisible = true
  const columns = Math.max(1, bubbles.filter(b => b.y === bubbles[0]?.y).length)
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key]
  if (step !== undefined) keyboardIndex = Math.max(0, Math.min(bubbles.length - 1, keyboardIndex + step))
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { prepareSound(); pop(bubbles[keyboardIndex]!, performance.now()); document.querySelector('#announcement')!.textContent = `${popCount}개 터뜨렸어요.` }
})
canvas.addEventListener('blur', () => { keyboardVisible = false })
addEventListener('blur', () => { pointers.clear(); hover = null })
document.addEventListener('visibilitychange', () => { pointers.clear(); hover = null; lastFrame = performance.now() })
addEventListener('resize', resize)
soundButton.addEventListener('click', () => {
  muted = !muted
  soundButton.classList.toggle('muted', muted)
  soundButton.setAttribute('aria-pressed', String(!muted))
  soundButton.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기')
  soundButton.title = muted ? '소리 켜기' : '소리 끄기'
  if (!muted) prepareSound()
})
document.querySelector('#reset')!.addEventListener('click', () => {
  const now = performance.now()
  for (const b of bubbles) { b.poppedAt = now - REINFLATE_MS * .2; b.delay = random(0, 300) }
  drops = []; labels = []; pointers.clear(); popCount = 0; countElement.textContent = '000'
  document.querySelector('#announcement')!.textContent = '모든 뽁뽁이가 다시 부풀어 올라요.'
})

function heart(c: CanvasRenderingContext2D, size: number) {
  c.beginPath(); c.moveTo(0, size * .75)
  c.bezierCurveTo(-size * 1.8, -size * .4, -size * .5, -size * 1.5, 0, -size * .5)
  c.bezierCurveTo(size * .5, -size * 1.5, size * 1.8, -size * .4, 0, size * .75); c.fill()
}
function draw(now: number) {
  const dt = Math.min(.035, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now
  ctx.clearRect(0, 0, width, height)
  for (const b of bubbles) {
    const fill = inflation(b, now)
    const hovered = hover && Math.hypot(hover.x - b.x, hover.y - b.y) < b.radius
    const breathe = reducedMotion.matches ? 0 : Math.sin(now * .0015 + b.phase) * .013
    // The deflated skin stays in place as a little red puddle.
    ellipse(ctx, b.x, b.y + b.radius * .38, b.radius * .93, b.radius * .48, '#29050c')
    ellipse(ctx, b.x, b.y + b.radius * .36, b.radius * .73, b.radius * .32, '#4d0917')
    if (fill > .01) {
      const size = b.radius * 2.6667 * (fill * .85 + .15) * (1 + (hovered && fill > .96 ? .065 : breathe))
      const scaleY = .28 + fill * .72
      const y = b.y + b.radius * .4 * (1 - fill)
      ctx.globalAlpha = .3 + fill * .7
      ctx.drawImage(sprites[b.face]!, b.x - size / 2, y - size * scaleY / 2, size, size * scaleY)
      ctx.globalAlpha = 1
    } else {
      ctx.strokeStyle = '#ad1a37'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(b.x - 7, b.y + b.radius * .36 - 3); ctx.lineTo(b.x - 3, b.y + b.radius * .36 + 1); ctx.lineTo(b.x + 1, b.y + b.radius * .36 - 3); ctx.stroke()
    }
    const elapsed = now - b.poppedAt
    if (elapsed < 320 && !reducedMotion.matches) {
      ctx.globalAlpha = (1 - elapsed / 320) * .7; ctx.strokeStyle = '#ff4661'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * (.8 + elapsed / 200), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1
    }
  }
  drops = drops.filter(d => now - d.born < d.duration)
  for (const d of drops) {
    const life = (now - d.born) / d.duration
    d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 310 * dt; d.vx *= Math.exp(-2 * dt)
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rotation + life * 2)
    ctx.globalAlpha = Math.min(1, (1 - life) * 2.4); ctx.fillStyle = d.color
    if (d.heart) heart(ctx, d.radius * (1 - life * .5))
    else { ctx.beginPath(); ctx.ellipse(0, 0, d.radius * (1 - life * .6), d.radius * (1.2 - life * .6), 0, 0, TAU); ctx.fill() }
    ctx.restore()
  }
  labels = labels.filter(l => now - l.born < 650)
  for (const label of labels) {
    const progress = (now - label.born) / 650
    ctx.save(); ctx.translate(label.x, label.y - progress * (reducedMotion.matches ? 8 : 34)); ctx.rotate(label.rotation)
    ctx.globalAlpha = Math.min(1, (1 - progress) * 2.6); ctx.fillStyle = '#ffc2c9'
    ctx.font = '800 18px "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label.text, 0, 0); ctx.restore()
  }
  if (keyboardVisible && document.activeElement === canvas) {
    const b = bubbles[keyboardIndex]!
    ctx.strokeStyle = '#ffc2c9'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([])
  }
  requestAnimationFrame(draw)
}
resize(); requestAnimationFrame(draw)
Object.defineProperty(window, '__bubblePop', { get: () => ({ pops: popCount, bubbles: bubbles.length, ready: bubbles.filter(b => inflation(b, performance.now()) >= .96).length, activePointers: pointers.size, particles: drops.length, muted, soundPlays: [...soundPlays], audioState: audio?.state ?? 'uninitialized' }) })

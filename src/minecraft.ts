import './minecraft.css'
import { Combat, centerOnPerson, equipment, maxHp } from './minecraft-combat'
import type { Direction, PersonMask, Weapon } from './minecraft-combat'
import { MineRenderer } from './minecraft-renderer'
import { BackgroundCapture, selectSilhouette } from './minecraft-background'

const slots = equipment.map((item, index) =>
  `<button type="button" class="mine-slot" data-weapon="${item.id}" aria-label="${item.name}" aria-pressed="false"><kbd>${index + 1}</kbd><img alt=""></button>`).join('')
const items = equipment.map((item, index) =>
  `<button type="button" class="mine-item" data-weapon="${item.id}" aria-pressed="false"><img alt=""><span>${item.name}</span><kbd>${index + 1}</kbd></button>`).join('')
document.querySelector('#app')!.innerHTML = `<main id="mine">
  <video class="mine-video" muted autoplay playsinline aria-hidden="true"></video>
  <canvas class="mine-view" tabindex="0" aria-label="중앙 조준점의 방향으로 공격. 클릭, 터치 또는 스페이스바"></canvas>
  <div class="mine-vignette"></div>
  <div class="mine-aim" aria-hidden="true"></div>
  <section class="mine-intro">
    <h1>MineCraft</h1>
    <p>조준점에 대상을 맞추고 화면을 누르세요.</p>
    <button type="button" class="mine-start">카메라 시작</button>
  </section>
  <div class="mine-status" role="status"></div>
  <div class="mine-hud">
    <div class="mine-life" hidden>
      <meter min="0" max="${maxHp}" value="${maxHp}" aria-label="대상 HP"></meter>
      <span class="mine-hp-value">${maxHp} HP</span>
      <button type="button" class="mine-respawn" hidden>다시 시작</button>
    </div>
    <div class="mine-selected" aria-live="polite"></div>
    <div class="mine-belt" role="group" aria-label="무기 선택">
      ${slots}<button type="button" class="mine-pack" aria-expanded="false" aria-controls="mine-inventory">가방 <kbd>E</kbd></button>
    </div>
    <section class="mine-inventory" id="mine-inventory" aria-label="인벤토리" hidden>
      <header><span>인벤토리</span><button type="button" class="mine-close" aria-label="인벤토리 닫기">×</button></header>
      ${items}
    </section>
  </div>
  <button type="button" class="mine-stop" hidden>카메라 끄기</button>
</main>`

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const video = get<HTMLVideoElement>('.mine-video')
const canvas = get<HTMLCanvasElement>('.mine-view')
const start = get<HTMLButtonElement>('.mine-start')
const stop = get<HTMLButtonElement>('.mine-stop')
const pack = get<HTMLButtonElement>('.mine-pack')
const inventory = get<HTMLElement>('.mine-inventory')
const aim = get<HTMLElement>('.mine-aim')
const status = get<HTMLDivElement>('.mine-status')
const intro = get<HTMLElement>('.mine-intro')
const life = get<HTMLElement>('.mine-life')
const hpMeter = get<HTMLMeterElement>('.mine-life meter')
const hpValue = get<HTMLSpanElement>('.mine-hp-value')
const respawn = get<HTMLButtonElement>('.mine-respawn')
const weaponButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#mine [data-weapon]'))
const combat = new Combat()
const backdrop = new BackgroundCapture()
let defeatedPerson: PersonMask | null = null
const inputCanvas = document.createElement('canvas')
const input = inputCanvas.getContext('2d', { willReadFrequently: true })
const events = new AbortController()
let renderer: MineRenderer | null = null
try {
  renderer = new MineRenderer(canvas, video)
} catch {
  start.disabled = true
  status.textContent = '3D 화면을 준비할 수 없어요. WebGL2를 지원하는 브라우저에서 다시 열어주세요.'
}

function updateHealth() {
  hpMeter.value = combat.hp
  hpValue.textContent = combat.dead ? '0 HP · 사망' : `${combat.hp} HP`
  respawn.hidden = !combat.dead
  life.classList.toggle('is-defeated', combat.dead)
}

function resetHealth() {
  combat.reset()
  defeatedPerson = null
  renderer?.clearDefeat()
  updateHealth()
}

function select(weapon: Weapon) {
  combat.select(weapon)
  get('.mine-selected').textContent = weapon.name
  for (const button of weaponButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.weapon === weapon.id))
  }
}

function showInventory(open: boolean, focus = true) {
  inventory.hidden = !open
  pack.setAttribute('aria-expanded', String(open))
  if (focus) {
    if (open) inventory.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus()
    else pack.focus()
  }
}

for (const button of weaponButtons) {
  const weapon = equipment.find(item => item.id === button.dataset.weapon)!
  const icon = renderer?.icons.get(weapon.id)
  if (icon) button.querySelector('img')!.src = icon
  button.addEventListener('click', () => {
    select(weapon)
    if (inventory.contains(button)) showInventory(false)
  })
}
select(equipment[0])
pack.addEventListener('click', () => showInventory(Boolean(inventory.hidden)))
get('.mine-close').addEventListener('click', () => showInventory(false))

type TrackerMessage = ({ type: 'mask'; generation: number; duration: number } & PersonMask) |
  { type: 'ready'; cpu: boolean } | { type: 'error'; message: string }
interface Segmenter {
  init(base: string, cpu: boolean): Promise<void>
  detect(source: HTMLCanvasElement, timestamp: number): PersonMask
  close(): void
}
const runtimeWindow = window as Window & { MineSegmenter?: new () => Segmenter; Vision?: unknown }
const scriptLoads = new Map<string, Promise<void>>()

function loadScript(url: string) {
  let pending = scriptLoads.get(url)
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const element = document.createElement('script')
      element.src = url
      element.onload = () => resolve()
      element.onerror = () => { element.remove(); scriptLoads.delete(url); reject(new Error('Model loader unavailable')) }
      document.head.append(element)
    })
    scriptLoads.set(url, pending)
  }
  return pending
}

let worker: Worker | null = null
let mainSegmenter: Segmenter | null = null
let workerCpu = false
let fallbackStarted = false
let session = 0
let averageInference = 20
let lastRender = -Infinity
let nextResolutionCheck = 0
let slowFrames = 0
let lastAnimation = 0
let aimTarget = false
let aimFlash = false
let bitmapMode = true
let stream: MediaStream | null = null
let mask: PersonMask | null = null
let generation = 0
let disposed = false
let ready = false
let busy = false
let lastCapture = 0
let lastVideoTime = -1
let trackingTimeout = 0
let frameId = 0

function stopTracking() {
  worker?.terminate()
  worker = null
  mainSegmenter?.close()
  mainSegmenter = null
  ready = busy = false
  mask = null
  clearTimeout(trackingTimeout)
}

function stopCamera() {
  generation++
  session++
  stopTracking()
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  video.srcObject = null
  lastVideoTime = -1
  resetHealth()
  backdrop.reset()
  life.hidden = true
  intro.hidden = false
  stop.hidden = true
  status.textContent = ''
}

const base = new URL(import.meta.env.BASE_URL, location.href)

function receiveMask(data: PersonMask, duration: number) {
  averageInference += (duration - averageInference) * .20
  mask = data
  backdrop.observe(data)
  if (!combat.dead) {
    renderer?.setMask(data)
    return
  }
  if (defeatedPerson) {
    const next = selectSilhouette(data, defeatedPerson)
    if (next.pixels.some(pixel => pixel >= 100)) defeatedPerson = next
    else if (data.timestamp - defeatedPerson.timestamp > 500) defeatedPerson = null
    renderer?.setMask(next)
  }
  refreshBackground()
}

function refreshBackground(force = false) {
  const plate = backdrop.plate
  const pixels = plate.rebuild(force)
  if (pixels) renderer?.setBackground(pixels, plate.width, plate.height)
}

function recordBackground(source: CanvasImageSource, timestamp: number, force = false) {
  try { backdrop.sample(source, video.videoWidth, video.videoHeight, timestamp, force) }
  catch { /* Tracking continues independently if camera pixels cannot be read. */ }
}

function defeatPerson(data: PersonMask, now: number) {
  defeatedPerson = selectSilhouette(data, null)
  if (!backdrop.plate.width) {
    recordBackground(video, data.timestamp, true)
    backdrop.observe(data)
  }
  refreshBackground(true)
  renderer?.defeat(defeatedPerson, now)
}

function trackerFailure() {
  session++
  stopTracking()
  status.textContent = '사람 윤곽을 인식하지 못했어요. 카메라를 껐다 켜면 다시 시도할 수 있어요.'
}

async function startFallback() {
  if (fallbackStarted) {
    trackerFailure()
    return
  }
  fallbackStarted = true
  stopTracking()
  const token = session
  status.textContent = '사람 윤곽 인식 준비 중…'
  trackingTimeout = window.setTimeout(trackerFailure, 35000)
  try {
    if (!runtimeWindow.Vision) await loadScript(new URL('mediapipe/vision_bundle.js', base).href)
    if (!runtimeWindow.MineSegmenter) await loadScript(new URL('minecraft-segmenter.js', base).href)
    if (token !== session || !stream || !input) return
    const tracker = new runtimeWindow.MineSegmenter!()
    mainSegmenter = tracker
    await tracker.init(base.href, true)
    if (token !== session) return
    clearTimeout(trackingTimeout)
    ready = true
    status.textContent = ''
  } catch { if (token === session) trackerFailure() }
}

function startTracking() {
  fallbackStarted = workerCpu = false
  bitmapMode = true
  averageInference = 20
  const current = new Worker(new URL('minecraft-tracker.js', base))
  worker = current
  status.textContent = '사람 윤곽 인식 준비 중…'
  trackingTimeout = window.setTimeout(() => void startFallback(), 35000)
  current.onerror = () => { if (current === worker) void startFallback() }
  current.onmessage = ({ data }: MessageEvent<TrackerMessage>) => {
    if (worker !== current) return
    clearTimeout(trackingTimeout)
    busy = false
    if (data.type === 'ready') {
      workerCpu = data.cpu
      ready = true
      status.textContent = ''
    } else if (data.type === 'mask') {
      if (data.generation === generation && !document.hidden) receiveMask(data, data.duration)
    } else void startFallback()
  }
  current.postMessage({ type: 'init', base: base.href })
}

async function startCamera() {
  if (!renderer || start.disabled || stream) return
  start.disabled = true
  start.textContent = '카메라 연결 중…'
  status.textContent = ''
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('카메라를 사용하려면 HTTPS 또는 localhost에서 열어주세요.')
    }
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    })
    if (disposed) {
      next.getTracks().forEach(track => track.stop())
      return
    }
    stream = next
    video.srcObject = stream
    await video.play()
    if (disposed || stream !== next) return
    intro.hidden = true
    stop.hidden = false
    life.hidden = false
    canvas.focus({ preventScroll: true })
    const track = next.getVideoTracks()[0]
    track?.addEventListener('ended', () => {
      if (stream !== next) return
      stopCamera()
      status.textContent = '카메라 연결이 끊어졌어요.'
    }, { once: true, signal: events.signal })
    if (document.hidden) {
      if (track) track.enabled = false
      video.pause()
    }
    try { startTracking() } catch { void startFallback() }
  } catch (error) {
    if (disposed) return
    stopCamera()
    status.textContent = error instanceof Error && error.name === 'NotAllowedError'
      ? '카메라 권한을 허용한 뒤 다시 눌러주세요.'
      : error instanceof Error && error.name === 'NotFoundError'
        ? '연결된 카메라를 찾지 못했어요.'
        : error instanceof Error ? error.message : '카메라를 시작하지 못했어요.'
  } finally {
    start.disabled = false
    start.textContent = '카메라 시작'
  }
}

function copyFrame(width: number, height: number) {
  if (!input) throw new Error('Camera frame copy unavailable')
  if (inputCanvas.width !== width) inputCanvas.width = width
  if (inputCanvas.height !== height) inputCanvas.height = height
  input.drawImage(video, 0, 0, width, height)
  return input
}

async function capture(now: number) {
  const current = worker
  const fallback = mainSegmenter
  const interval = Math.min(230, Math.max(fallback ? 125 : workerCpu ? 90 : 65, averageInference * 3))
  if ((!current && !fallback) || !ready || busy || video.readyState < 2 ||
      now - lastCapture < interval || lastVideoTime === video.currentTime) return
  busy = true
  lastCapture = now
  lastVideoTime = video.currentTime
  const token = generation
  const longestSide = Math.max(video.videoWidth, video.videoHeight)
  const scale = Math.min(1, (fallback || workerCpu ? 384 : 512) / longestSide)
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))

  if (fallback) {
    try {
      copyFrame(width, height)
      recordBackground(inputCanvas, now)
      const startTime = performance.now()
      receiveMask(fallback.detect(inputCanvas, now), performance.now() - startTime)
    } catch { trackerFailure() }
    finally { busy = false }
    return
  }
  if (!current) return
  trackingTimeout = window.setTimeout(() => void startFallback(), 12000)
  try {
    let bitmap: ImageBitmap | undefined
    if (bitmapMode) {
      try { bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: height }) }
      catch { bitmapMode = false }
    }
    if (token !== generation || current !== worker) {
      bitmap?.close()
      if (current === worker) {
        busy = false
        clearTimeout(trackingTimeout)
      }
      return
    }
    const frame = { type: 'frame', timestamp: now, generation: token }
    if (bitmap) {
      try {
        recordBackground(bitmap, now)
        current.postMessage({ ...frame, bitmap }, [bitmap])
        return
      } catch {
        bitmap.close()
        bitmapMode = false
      }
    }
    const context = copyFrame(width, height)
    recordBackground(inputCanvas, now)
    const { data: pixels } = context.getImageData(0, 0, width, height)
    current.postMessage({ ...frame, pixels, width, height }, [pixels.buffer])
  } catch {
    if (current === worker) void startFallback()
  }
}

function frame(now: number) {
  if (disposed || document.hidden) return
  const onTarget = !combat.dead && centerOnPerson(mask, now)
  const hp = combat.hp
  if (combat.update(now, onTarget) && mask) defeatPerson(mask, now)
  if (hp !== combat.hp) updateHealth()
  const target = onTarget && !combat.dead
  const flash = mask && now - mask.timestamp <= 500 ? combat.flash(now) : 0
  if (aimTarget !== target) {
    aimTarget = target
    aim.dataset.target = String(target)
  }
  if (aimFlash !== (flash > 0)) {
    aimFlash = flash > 0
    aim.dataset.flash = String(aimFlash)
  }
  const animated = !!combat.strike || flash > 0 || renderer?.burstActive(now)
  if (lastAnimation && now - lastAnimation > 25) slowFrames++
  lastAnimation = now
  if (now >= nextResolutionCheck) {
    if (slowFrames > 12) renderer?.reduceResolution()
    slowFrames = 0
    nextResolutionCheck = now + 1800
  }
  const renderInterval = animated ? 1000 / 60 : 1000 / 30
  if (now - lastRender >= renderInterval - 1) {
    lastRender = now
    renderer?.render(now, combat.weapon, combat.strike, flash)
  }
  void capture(now)
  frameId = requestAnimationFrame(frame)
}

function attack(direction: Direction) {
  if (renderer && inventory.hidden) combat.attack(performance.now(), direction)
}

start.addEventListener('click', () => void startCamera())
stop.addEventListener('click', () => { stopCamera(); start.focus() })
respawn.addEventListener('click', () => { resetHealth(); canvas.focus({ preventScroll: true }) })
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return
  const bounds = canvas.getBoundingClientRect()
  attack({
    x: (event.clientX - bounds.left) / bounds.width * 2 - 1,
    y: 1 - (event.clientY - bounds.top) / bounds.height * 2,
  })
})
addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
  const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code)
  if (index >= 0) select(equipment[index]!)
  if (event.code === 'KeyE') showInventory(Boolean(inventory.hidden))
  if (event.code === 'Escape' && !inventory.hidden) showInventory(false)
  if (event.code === 'Space' && (event.target === canvas || event.target === document.body) && inventory.hidden) {
    event.preventDefault()
    attack({ x: 0, y: 0 })
  }
}, { signal: events.signal })
addEventListener('resize', () => renderer?.resize(), { signal: events.signal })
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    generation++
    mask = null
    combat.cancelAttack()
    lastAnimation = slowFrames = 0
    cancelAnimationFrame(frameId)
    stream?.getVideoTracks().forEach(track => { track.enabled = false })
    video.pause()
    return
  }
  lastVideoTime = -1
  if (stream) {
    stream.getVideoTracks().forEach(track => { track.enabled = true })
    void video.play().catch(() => {
      stopCamera()
      status.textContent = '카메라를 다시 시작해주세요.'
    })
  }
  cancelAnimationFrame(frameId)
  frameId = requestAnimationFrame(frame)
}, { signal: events.signal })
function dispose() {
  if (disposed) return
  disposed = true
  events.abort()
  cancelAnimationFrame(frameId)
  stopCamera()
  renderer?.dispose()
}
addEventListener('pagehide', dispose, { once: true, signal: events.signal })
addEventListener('pageshow', event => { if (event.persisted) location.reload() }, { once: true })
if (import.meta.hot) import.meta.hot.dispose(dispose)
frameId = requestAnimationFrame(frame)

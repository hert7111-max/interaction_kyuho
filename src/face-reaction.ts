import './face-reaction.css'
import { FaceReaction, faceFrame, fistCenter } from './face-reaction-engine'
import type { FaceFrame } from './face-reaction-engine'
import { FaceReactionRenderer } from './face-reaction-renderer'
import { RubberTracking } from './rubber-tracking'
import type { Tracking } from './rubber-tracking'

document.querySelector('#app')!.innerHTML = `<main id="reaction-stage">
  <video class="reaction-video" autoplay muted playsinline aria-hidden="true"></video>
  <canvas class="reaction-view" aria-label="실시간 카메라 얼굴 효과"></canvas>
  <section class="reaction-intro">
    <h1>페이스 리액션</h1>
    <p>얼굴 옆 허공에서 주먹으로 시늉하면 얼굴에 효과가 쌓입니다.</p>
    <button type="button" class="reaction-start">카메라 시작</button>
  </section>
  <div class="reaction-controls" hidden>
    <p class="reaction-status" role="status">얼굴·손 인식 준비 중…</p>
    <button type="button" class="reaction-reset">효과 초기화</button>
    <button type="button" class="reaction-stop">카메라 끄기</button>
  </div>
  <p class="reaction-error" role="alert" hidden></p>
</main>`

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const video = get<HTMLVideoElement>('.reaction-video')
const canvas = get<HTMLCanvasElement>('.reaction-view')
const start = get<HTMLButtonElement>('.reaction-start')
const stop = get<HTMLButtonElement>('.reaction-stop')
const intro = get<HTMLElement>('.reaction-intro')
const controls = get<HTMLDivElement>('.reaction-controls')
const status = get<HTMLParagraphElement>('.reaction-status')
const alert = get<HTMLParagraphElement>('.reaction-error')
const hint = '얼굴 옆 허공에서 주먹 동작'
const engine = new FaceReaction()
const events = new AbortController()
let renderer: FaceReactionRenderer | null = null
let tracker: RubberTracking | null = null
let stream: MediaStream | null = null
let face: FaceFrame | null = null
let lastFace = -Infinity
let lastFacePacket = -Infinity
let lastFaceReceived = -Infinity
const usesVideoFrames = typeof video.requestVideoFrameCallback === 'function'
let videoCallback = 0
let generation = 0
let frameGeneration = 0
let disposed = false
let busy = false
let ready = false
let lastVideo = -1
let lastCapture = -Infinity
let lastRender = -Infinity
let animation = 0
let watchdog = 0

function showError(message: string) {
  alert.textContent = message
  alert.hidden = !message
}

try { renderer = new FaceReactionRenderer(canvas, video) }
catch {
  start.disabled = true
  showError('화면 효과를 실행하려면 WebGL2를 지원하는 브라우저에서 열어주세요.')
}

function resetEffect() {
  engine.reset()
  renderer?.clear()
  status.textContent = hint
}

function stopCamera() {
  generation++
  frameGeneration++
  cancelAnimationFrame(animation)
  stopVideoFrames()
  clearTimeout(watchdog)
  tracker?.close()
  tracker = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  video.srcObject = null
  busy = ready = false
  lastVideo = -1
  lastCapture = lastRender = lastFace = lastFacePacket = lastFaceReceived = -Infinity
  face = null
  resetEffect()
  intro.hidden = false
  controls.hidden = true
  start.disabled = !renderer
  start.textContent = '카메라 시작'
}

function fail(message: string) {
  stopCamera()
  showError(message)
}

function receive(data: Tracking) {
  if (document.hidden || data.generation !== frameGeneration) return
  const aspect = video.videoWidth / video.videoHeight
  const faceTime = data.faceTimestamp ?? data.timestamp
  if (faceTime > lastFacePacket) {
    lastFacePacket = faceTime
    const sampledFace = faceFrame(data.face, aspect)
    if (sampledFace) {
      face = sampledFace
      lastFace = faceTime
      lastFaceReceived = performance.now()
    }
  }
  const current = face
  const faceGrace = Math.min(300, Math.max(160, (tracker?.budget.average ?? 0) * 1.75 + 45))
  if (!current || data.timestamp - lastFace > faceGrace) {
    engine.clearHands()
    return
  }
  const seen = new Set<string>()
  const before = engine.hits
  const effectTime = performance.now()
  for (const [i, hand] of data.landmarks.entries()) {
    let id = data.handedness[i]?.[0]?.categoryName ?? String(i)
    if (seen.has(id)) id += i
    seen.add(id)
    engine.punch(id, fistCenter(hand, aspect), current, data.timestamp, effectTime)
  }
  engine.retain(seen, data.timestamp)
  if (engine.hits !== before) status.textContent = `효과 ${engine.hits}회`
}

async function capture(now: number, mediaTime = video.currentTime) {
  const current = tracker
  if (!current || !ready || busy || video.readyState < 2 || mediaTime === lastVideo ||
      now - lastCapture < current.budget.interval) return
  const token = frameGeneration
  busy = true
  lastCapture = now
  lastVideo = mediaTime
  watchdog = window.setTimeout(() => fail('얼굴·손 인식이 멈췄어요. 카메라를 다시 시작해주세요.'), 12000)
  try { await current.frame(video, now, token) }
  catch {
    if (tracker !== current) return
    busy = false
    clearTimeout(watchdog)
    if (token === frameGeneration) fail('카메라 영상을 읽지 못했어요.')
  }
}

function scheduleVideoFrames() {
  if (!usesVideoFrames || videoCallback || disposed || document.hidden || !stream) return
  videoCallback = video.requestVideoFrameCallback((now, metadata) => {
    videoCallback = 0
    void capture(now, metadata.mediaTime)
    scheduleVideoFrames()
  })
}

function stopVideoFrames() {
  if (videoCallback) video.cancelVideoFrameCallback?.(videoCallback)
  videoCallback = 0
}

function frame(now: number) {
  if (disposed || document.hidden || !stream) return
  if (!usesVideoFrames) void capture(now)
  const interval = engine.moving(now) ? 1000 / 60 : 1000 / 30
  if (now - lastRender >= interval - 1) {
    lastRender = now
    const displayGrace = Math.min(560, Math.max(325, (tracker?.budget.average ?? 0) * 2.5 + 120))
    renderer?.render(now, now - lastFaceReceived <= displayGrace ? face : null, engine)
  }
  animation = requestAnimationFrame(frame)
}

async function startCamera() {
  if (start.disabled || !renderer || stream || disposed) return
  const token = ++generation
  start.disabled = true
  start.textContent = '카메라 연결 중…'
  showError('')
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('카메라를 사용하려면 HTTPS 또는 localhost에서 열어주세요.')
    }
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
    })
    if (token !== generation) {
      next.getTracks().forEach(track => track.stop())
      return
    }
    stream = next
    video.srcObject = next
    await video.play()
    if (token !== generation) return
    intro.hidden = true
    controls.hidden = false
    status.textContent = '얼굴·손 인식 준비 중…'
    const track = next.getVideoTracks()[0]
    track?.addEventListener('ended', () => {
      if (stream === next) fail('카메라 연결이 끊겼어요.')
    }, { once: true, signal: events.signal })
    if (document.hidden) {
      if (track) track.enabled = false
      video.pause()
    } else {
      cancelAnimationFrame(animation)
      animation = requestAnimationFrame(frame)
      scheduleVideoFrames()
    }

    // Keep tracking off the GPU so the video shader can use it without contention.
    const current = new RubberTracking({ cpu: true, fastHands: true })
    tracker = current
    current.onresult = result => {
      if (tracker !== current) return
      busy = false
      clearTimeout(watchdog)
      receive(result)
    }
    current.onerror = () => { if (tracker === current) fail('얼굴·손 인식이 중단됐어요.') }
    await current.init(new URL(import.meta.env.BASE_URL, location.href).href)
    if (tracker !== current) return
    ready = true
    status.textContent = hint
  } catch (error) {
    if (token !== generation) return
    fail(error instanceof Error && error.name === 'NotAllowedError'
      ? '카메라 권한을 허용한 뒤 다시 눌러주세요.'
      : error instanceof Error && error.name === 'NotFoundError'
        ? '연결된 카메라를 찾지 못했어요.'
        : error instanceof Error ? error.message : '카메라를 시작하지 못했어요.')
  }
}

start.addEventListener('click', () => void startCamera(), { signal: events.signal })
stop.addEventListener('click', () => { stopCamera(); start.focus() }, { signal: events.signal })
get('.reaction-reset').addEventListener('click', resetEffect, { signal: events.signal })
addEventListener('resize', () => renderer?.resize(), { signal: events.signal })
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    frameGeneration++
    clearTimeout(watchdog)
    cancelAnimationFrame(animation)
    stopVideoFrames()
    lastFace = lastFacePacket = lastFaceReceived = -Infinity
    face = null
    engine.clearHands()
    stream?.getVideoTracks().forEach(track => { track.enabled = false })
    video.pause()
    return
  }
  if (!stream) return
  if (busy) watchdog = window.setTimeout(() => fail('얼굴·손 인식이 멈췄어요.'), 12000)
  lastVideo = -1
  stream.getVideoTracks().forEach(track => { track.enabled = true })
  void video.play().catch(() => fail('카메라를 다시 시작해주세요.'))
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(frame)
  scheduleVideoFrames()
}, { signal: events.signal })

function dispose() {
  disposed = true
  events.abort()
  stopCamera()
  renderer?.dispose()
}
addEventListener('pagehide', dispose, { once: true, signal: events.signal })
addEventListener('pageshow', event => { if (event.persisted) location.reload() })
if (import.meta.hot) import.meta.hot.dispose(dispose)

import './invisible.css'
import { OverheadClap } from './invisible-clap'
import { InvisibleOverlay } from './invisible-overlay'
import { InvisibleTracker } from './invisible-tracker'
import type { BodyFrame } from './invisible-tracker'

document.querySelector('#app')!.innerHTML = `<main id="invisible-stage">
  <video class="invisible-video" autoplay muted playsinline aria-hidden="true"></video>
  <canvas class="invisible-overlay" aria-hidden="true"></canvas>
  <section class="invisible-intro">
    <h1>투명인간</h1>
    <p>머리 위에서 박수를 치면 화면 속 사람들이 배경으로 사라집니다.</p>
    <button type="button" class="invisible-start">카메라 시작</button>
  </section>
  <div class="invisible-controls" hidden>
    <p class="invisible-state" role="status">머리 위에서 박수 한 번</p>
    <button type="button" class="invisible-reveal" hidden>다시 보이기</button>
    <button type="button" class="invisible-stop">카메라 끄기</button>
  </div>
  <p class="invisible-error" role="alert" hidden></p>
</main>`

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const stage = get<HTMLElement>('#invisible-stage')
const video = get<HTMLVideoElement>('.invisible-video')
const start = get<HTMLButtonElement>('.invisible-start')
const stop = get<HTMLButtonElement>('.invisible-stop')
const reveal = get<HTMLButtonElement>('.invisible-reveal')
const intro = get<HTMLElement>('.invisible-intro')
const controls = get<HTMLDivElement>('.invisible-controls')
const state = get<HTMLParagraphElement>('.invisible-state')
const alert = get<HTMLParagraphElement>('.invisible-error')
const overlay = new InvisibleOverlay(get<HTMLCanvasElement>('.invisible-overlay'))
const clap = new OverheadClap()
const events = new AbortController()
let tracker: InvisibleTracker | null = null
let stream: MediaStream | null = null
let invisible = false
let disposed = false
let generation = 0
let frameId = 0

function showError(message: string) {
  alert.textContent = message
  alert.hidden = !message
}

function setInvisible(enabled: boolean) {
  invisible = enabled
  if (!enabled) stage.dataset.effect = 'off'
  reveal.hidden = !enabled
  state.textContent = enabled ? '투명 모드 · 다시 박수치면 돌아옵니다' : '머리 위에서 박수 한 번'
}

function receiveFrame(data: BodyFrame, current: InvisibleTracker) {
  if (current !== tracker || document.hidden) return
  const activated = clap.update(data.poses, video.videoWidth / video.videoHeight, data.timestamp)
  if (activated) setInvisible(!invisible)
  if (invisible && overlay.render(data, current.background.plate, activated)) stage.dataset.effect = 'on'
}

function animate(now: number) {
  if (disposed || document.hidden || !stream) return
  void tracker?.capture(video, now)
  frameId = requestAnimationFrame(animate)
}

function stopCamera() {
  generation++
  cancelAnimationFrame(frameId)
  tracker?.close()
  tracker = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  video.srcObject = null
  clap.reset()
  setInvisible(false)
  overlay.clear()
  intro.hidden = false
  controls.hidden = true
  start.disabled = false
  start.textContent = '카메라 시작'
}

async function startCamera() {
  if (start.disabled || stream || disposed) return
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
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
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
    state.textContent = '몸 추적 준비 중…'
    for (const track of next.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (stream !== next) return
        stopCamera()
        showError('카메라 연결이 끊겼어요.')
      }, { once: true, signal: events.signal })
      if (document.hidden) track.enabled = false
    }
    if (document.hidden) video.pause()
    const current = new InvisibleTracker()
    tracker = current
    current.onFrame = data => receiveFrame(data, current)
    current.onError = () => {
      if (current !== tracker) return
      stopCamera()
      showError('몸 추적이 중단됐어요. 카메라를 다시 시작해주세요.')
    }
    await current.init()
    if (token !== generation || current !== tracker) return
    state.textContent = '머리 위에서 박수 한 번'
    if (!document.hidden) {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(animate)
    }
  } catch (error) {
    if (token !== generation) return
    stopCamera()
    showError(error instanceof Error && error.name === 'NotAllowedError'
      ? '카메라 권한을 허용한 뒤 다시 눌러주세요.'
      : error instanceof Error && error.name === 'NotFoundError'
        ? '연결된 카메라를 찾지 못했어요.'
        : '카메라나 몸 추적을 시작하지 못했어요. ' + (error instanceof Error ? error.message : ''))
  }
}

start.addEventListener('click', () => void startCamera(), { signal: events.signal })
stop.addEventListener('click', () => { stopCamera(); start.focus() }, { signal: events.signal })
reveal.addEventListener('click', () => { setInvisible(false); clap.reset(); stop.focus() }, { signal: events.signal })
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameId)
    tracker?.pause()
    clap.reset()
    stage.dataset.effect = 'off'
    stream?.getVideoTracks().forEach(track => { track.enabled = false })
    video.pause()
  } else if (stream) {
    stream.getVideoTracks().forEach(track => { track.enabled = true })
    void video.play().catch(() => { stopCamera(); showError('카메라를 다시 시작해주세요.') })
    cancelAnimationFrame(frameId)
    frameId = requestAnimationFrame(animate)
  }
}, { signal: events.signal })

function dispose() {
  disposed = true
  events.abort()
  stopCamera()
}
addEventListener('pagehide', dispose, { once: true, signal: events.signal })
addEventListener('pageshow', event => { if (event.persisted) location.reload() })
if (import.meta.hot) import.meta.hot.dispose(dispose)

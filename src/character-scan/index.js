import './styles.css'
import { CONFIG } from '../config.js'
import { openCamera, closeCamera } from './camera.js'
import { ScanTracker } from './tracking.js'
import { ScanOverlay } from './overlay.js'
import { sampleScanFrame, createScanAccumulator } from './scan-data.js'
import { createScanMachine, PHASE } from './state-machine.js'
import { setupHUD } from './hud.js'
import { CharacterScene } from './character-scene.js'
import { GestureDetector, GESTURE } from '../gesture.js'

document.querySelector('#app').innerHTML = `
  <main id="scan-stage" data-phase="IDLE" aria-label="캐릭터 스캔">
    <video class="scan-video" muted autoplay playsinline aria-hidden="true"></video>
    <canvas class="scan-character" aria-hidden="true"></canvas>
    <canvas class="scan-overlay" aria-hidden="true"></canvas>
    <div class="scan-hud">
      <div class="scan-entry">
        <button type="button" class="scan-start">CLICK TO SCAN</button>
        <p class="scan-status" role="status"></p>
      </div>
      <p class="scan-subject-label" role="status" hidden>SUBJECT GENERATED</p>
      <div class="scan-state" role="status" hidden><span></span></div>
      <aside class="scan-log" aria-label="스캔 진행 상황" hidden>
        <div class="scan-log-title"><span>SCANNING</span><output class="scan-percentage">0%</output></div>
        <div class="scan-progress" role="progressbar" aria-label="스캔 진행률" aria-valuenow="0"><span></span></div>
        <ol class="scan-steps"></ol>
      </aside>
      <p class="scan-control" role="status" hidden></p>
      <pre class="scan-debug" aria-label="제스처 진단" hidden></pre>
    </div>
  </main>
`

const stage = document.querySelector('#scan-stage')
const menu = document.querySelector('.experiment-menu')
const video = stage.querySelector('video')
const characterCanvas = stage.querySelector('.scan-character')
const overlay = new ScanOverlay(stage.querySelector('.scan-overlay'), video)
const hud = setupHUD(stage)
const machine = createScanMachine()
const gestures = new GestureDetector()
const events = new AbortController()
let stream, tracker, accumulator, latest, buildPose, character
let generation = 0
let raf = 0
let busy = false
let previousCapture = -Infinity
let previousVideoTime = -1
let disposed = false
let handsReady = false
let observationEpoch = 0
let lastHandPacket = -Infinity
let handInput = gestures.output
let jumpPending = false
let debug = false
let lastDebug = -Infinity
export let scanResult = null

function updatePhase() { stage.dataset.phase = machine.phase }

function clearSession() {
  generation++
  cancelAnimationFrame(raf)
  resetHandInput()
  handsReady = false
  debug = false
  tracker?.close()
  tracker = null
  closeCamera(stream)
  stream = null
  video.srcObject = null
  latest = null
  buildPose = null
  character?.dispose()
  character = null
  busy = false
  previousCapture = -Infinity
  previousVideoTime = -1
  overlay.clear()
}

function reset(message = '') {
  clearSession()
  machine.reset()
  scanResult = null
  updatePhase()
  hud.idle(message)
}

function finish(now) {
  const result = accumulator.finish()
  if (!result) {
    reset('얼굴과 양쪽 어깨, 가슴이 보이게 한 뒤 다시 스캔해주세요.')
    return
  }
  tracker?.close()
  tracker = null
  overlay.clear()
  let loaded = false
  try {
    character = new CharacterScene(characterCanvas, result, menu)
    loaded = true
  } catch {
    hud.buildFailed()
  }
  // Begin the two-second clock after the first wireframe draw is ready.
  if (!machine.finish(Math.max(now, performance.now()), result)) return
  scanResult = machine.scanResult
  updatePhase()
  if (loaded) {
    hud.building()
    raf = requestAnimationFrame(build)
  }
  stage.dispatchEvent(new CustomEvent('scancomplete', { detail: scanResult, bubbles: true }))
}

function build(now) {
  if (machine.phase !== PHASE.BUILDING || !character) return
  const progress = machine.buildProgress(now)
  character.render(progress)
  overlay.transfer(buildPose, character.destinations(), progress)
  hud.buildProgress(progress)
  if (machine.completeBuild(now)) {
    updatePhase()
    hud.complete()
    void startControl()
    return
  }
  raf = requestAnimationFrame(build)
}

function resetHandInput() {
  observationEpoch++
  gestures.reset()
  handInput = gestures.output
  jumpPending = false
  lastHandPacket = -Infinity
  lastDebug = -Infinity
  overlay.drawHand(null)
}

function showHandInput(now, force = false) {
  if (!debug || (!force && now - lastDebug < CONFIG.gesture.debug.logIntervalMs)) return
  lastDebug = now
  hud.debug(handInput)
  console.info('[character-scan]', handInput.gesture, {
    energy: handInput.energy, fingers: handInput.extensions, category: handInput.category,
  })
}

function stopHandTracking(message) {
  handsReady = false
  tracker?.close()
  tracker = null
  resetHandInput()
  hud.controlStatus(message)
}

function presentHand() {
  const hand = handInput.hand
  overlay.drawHand(hand?.point)
  hud.controlStatus(hand ? CONFIG.gesture.hint.active : CONFIG.gesture.hint.waiting)
}

async function startControl() {
  resetHandInput()
  if (!document.hidden) raf = requestAnimationFrame(control)
  if (!stream) {
    hud.controlStatus('카메라 연결이 끊겼어요.')
    return
  }
  busy = false
  previousCapture = -Infinity
  previousVideoTime = -1
  hud.controlStatus('HAND TRACKING...')
  const hands = new ScanTracker('gesture')
  tracker = hands
  try {
    await hands.init()
    if (tracker !== hands || disposed) return
    handsReady = true
    presentHand()
  } catch {
    if (tracker === hands) stopHandTracking('손 추적을 시작하지 못했어요. 다시 스캔해주세요.')
  }
}

async function captureHand(now) {
  const current = tracker
  if (!handsReady || !current || busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      previousVideoTime === video.currentTime || now - previousCapture < current.interval) return
  const epoch = observationEpoch
  busy = true
  previousVideoTime = video.currentTime
  previousCapture = now
  try {
    const frame = await current.frame(video, now)
    if (current !== tracker || epoch !== observationEpoch || document.hidden || !frame) return
    lastHandPacket = performance.now()
    handInput = gestures.update({ ...frame, aspect: video.videoWidth / video.videoHeight }, frame.timestamp)
    jumpPending ||= handInput.jump
    presentHand()
    showHandInput(lastHandPacket)
  } catch {
    if (current === tracker) stopHandTracking('손 추적이 끊겼어요. 다시 스캔해주세요.')
  } finally {
    if (current === tracker) busy = false
  }
}

function control(now) {
  if (machine.phase !== PHASE.CONTROL || document.hidden || !character) return
  if (handsReady && (handInput.hand || handInput.gesture !== GESTURE.IDLE) &&
      now - lastHandPacket > CONFIG.gesture.follow.reacquireMs) {
    gestures.reset()
    handInput = gestures.output
    jumpPending = false
    presentHand()
    showHandInput(now)
  }
  const state = character.control(now, { ...handInput, jump: jumpPending })
  if (state) hud.characterState(state)
  jumpPending = false
  if (handsReady) void captureHand(now)
  raf = requestAnimationFrame(control)
}

async function capture(now) {
  const current = tracker
  if (!current || busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      previousVideoTime === video.currentTime || now - previousCapture < current.interval) return
  const token = generation
  busy = true
  previousCapture = now
  previousVideoTime = video.currentTime
  try {
    const frame = await current.frame(video, now)
    if (token !== generation || machine.phase !== PHASE.SCANNING || !frame) return
    latest = frame.landmarks ? { landmarks: frame.landmarks, timestamp: frame.timestamp } : null
    if (latest) buildPose = frame.landmarks
    if (latest && frame.pixels) accumulator.add(sampleScanFrame(frame.landmarks, frame.pixels, frame.mask))
  } catch {
    if (token === generation && machine.phase === PHASE.SCANNING) reset('몸을 추적하지 못했어요. 다시 스캔해주세요.')
  } finally {
    if (token === generation) busy = false
  }
}

function frame(now) {
  if (machine.phase !== PHASE.SCANNING) return
  const progress = machine.progress(now)
  if (progress >= 1) {
    finish(now)
    return
  }
  hud.update(progress)
  overlay.draw(
    latest && now - latest.timestamp <= CONFIG.overlay.maximumPoseAgeMs ? latest.landmarks : null,
    tracker.connections, progress,
  )
  void capture(now)
  raf = requestAnimationFrame(frame)
}

async function start() {
  if (disposed || hud.button.disabled) return
  reset()
  hud.loading()
  const token = generation
  try {
    const camera = await openCamera()
    if (token !== generation) { closeCamera(camera); return }
    stream = camera
    for (const track of camera.getVideoTracks()) track.addEventListener('ended', () => {
      if (token !== generation) return
      if (machine.phase === PHASE.BUILDING || machine.phase === PHASE.CONTROL) {
        if (machine.phase === PHASE.CONTROL) stopHandTracking('카메라 연결이 끊겼어요.')
        closeCamera(stream)
        stream = null
        video.srcObject = null
      } else reset('카메라 연결이 끊겼어요. 다시 스캔해주세요.')
    }, { once: true, signal: events.signal })
    video.srcObject = camera
    await video.play()
    if (token !== generation) return
    const current = new ScanTracker()
    tracker = current
    await current.init()
    if (token !== generation) return
    accumulator = createScanAccumulator()
    machine.start(performance.now())
    updatePhase()
    hud.start()
    raf = requestAnimationFrame(frame)
  } catch (error) {
    if (token !== generation) return
    reset(error?.name === 'NotAllowedError'
      ? '카메라 권한을 허용한 뒤 다시 시도해주세요.'
      : error?.message ?? '스캔을 시작하지 못했어요.')
  }
}

hud.button.addEventListener('click', () => void start(), { signal: events.signal })
addEventListener('keydown', event => {
  if (event.code !== CONFIG.gesture.debug.key || event.repeat || machine.phase !== PHASE.CONTROL) return
  debug = !debug
  if (debug) {
    hud.debug(handInput)
    if (handsReady) showHandInput(performance.now(), true)
    else console.info('[character-scan]', handInput)
  } else hud.debug(null)
}, { signal: events.signal })
addEventListener('resize', () => {
  overlay.resize()
  character?.resize()
}, { signal: events.signal })
document.addEventListener('visibilitychange', () => {
  const showingSubject = machine.phase === PHASE.BUILDING || machine.phase === PHASE.CONTROL
  if (!document.hidden) {
    if (showingSubject && stream) {
      stream.getVideoTracks().forEach(track => { track.enabled = true })
      void video.play().catch(() => {})
    }
    if (machine.phase === PHASE.BUILDING && character) {
      machine.resumeBuild(performance.now())
      raf = requestAnimationFrame(build)
    } else if (machine.phase === PHASE.CONTROL) {
      previousVideoTime = -1
      raf = requestAnimationFrame(control)
    }
    return
  }
  if (machine.phase === PHASE.SCANNING || (machine.phase === PHASE.IDLE && hud.button.disabled)) {
    reset()
  } else if (showingSubject) {
    if (machine.phase === PHASE.BUILDING && character) {
      machine.pauseBuild(performance.now())
      cancelAnimationFrame(raf)
    } else if (machine.phase === PHASE.CONTROL) {
      cancelAnimationFrame(raf)
      resetHandInput()
      character?.control(performance.now(), { gesture: GESTURE.STOP, energy: 0, jump: false })
    }
    stream?.getVideoTracks().forEach(track => { track.enabled = false })
    video.pause()
  }
}, { signal: events.signal })
addEventListener('pagehide', () => { disposed = true; clearSession(); events.abort() }, { once: true })
addEventListener('pageshow', event => { if (event.persisted) location.reload() })
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; clearSession(); events.abort() })

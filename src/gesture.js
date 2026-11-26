import { CONFIG } from './config.js'

export const GESTURE = Object.freeze({ STOP: 'STOP', JUMP: 'JUMP', RUN: 'RUN', FOLLOW: 'FOLLOW', IDLE: 'IDLE' })
const settings = CONFIG.gesture
const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
const clamp = value => Math.max(0, Math.min(1, value))
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const planar = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mix = (a, b, t) => a + (b - a) * t

function handAxis(offset, range) {
  const { deadZone } = settings.follow
  return Math.sign(offset) * clamp((Math.abs(offset) - deadZone) / (range - deadZone))
}

function extension(points, finger) {
  const joints = settings.joints[finger].map(index => points[index])
  const arc = distance(joints[0], joints[1]) + distance(joints[1], joints[2]) + distance(joints[2], joints[3])
  const [lo, hi] = settings.bendRange
  return arc > 0 ? clamp((distance(joints[0], joints[3]) / arc - lo) / (hi - lo)) : 0
}

// Return a complete window with a linearly interpolated boundary sample.
function windowAt(samples, now, duration, eligible) {
  const start = now - duration
  const next = samples.findIndex(sample => sample.time > start)
  if (next <= 0 || !eligible(samples[next - 1]) || !samples.slice(next).every(eligible)) return []
  const a = samples[next - 1], b = samples[next]
  const t = (start - a.time) / (b.time - a.time)
  return [{
    time: start,
    tip: a.tip.map((point, i) => ({
      x: mix(point.x, b.tip[i].x, t), y: mix(point.y, b.tip[i].y, t),
    })),
    y: a.y.map((value, i) => mix(value, b.y[i], t)),
    palm: mix(a.palm, b.palm, t),
  }, ...samples.slice(next)]
}

function stationary(samples) {
  if (!samples.length) return false
  const travel = [0, 0]
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i]
    for (const [finger, point] of b.tip.entries()) {
      travel[finger] += planar(point, a.tip[finger]) / ((a.palm + b.palm) / 2)
    }
  }
  return travel.every(value => value <= settings.stillTravel)
}

function runningEnergy(samples) {
  let movement = 0, previousSign = 0, alternations = 0, last = samples[0]
  for (const sample of samples.slice(1)) {
    const index = sample.y[0] - last.y[0], middle = sample.y[1] - last.y[1]
    const span = Math.min(Math.abs(index), Math.abs(middle))
    if (span < settings.oppositionDeadband) continue
    last = sample
    if (index * middle >= 0) continue
    const sign = Math.sign(index)
    if (previousSign && previousSign !== sign) alternations++
    previousSign = sign
    movement += span
  }
  return alternations >= settings.minAlternations ? clamp(movement / settings.fullEnergyTravel) : 0
}

export class GestureDetector {
  constructor() { this.reset() }

  reset() {
    this.gesture = GESTURE.IDLE
    this.candidate = GESTURE.IDLE
    this.candidateSince = -Infinity
    this.lastTime = -Infinity
    this.lastJump = -Infinity
    this.jumpLatched = false
    this.releaseSince = this.thumbSince = this.victorySince = null
    this.handId = null
    this.handOrigin = this.lastPalm = null
    this.lastHandSeen = -Infinity
    this.filtered = null
    this.history = []
    this.output = { gesture: GESTURE.IDLE, energy: 0, extensions: null, jump: false, category: null, hand: null }
  }

  transition(next, time, qualified = false) {
    if (next !== this.candidate) {
      this.candidate = next
      this.candidateSince = time
    }
    if (qualified || time - this.candidateSince >= settings.hysteresisMs) this.gesture = next
  }

  clearObservation() {
    this.filtered = null
    this.history.length = 0
    this.thumbSince = this.victorySince = this.releaseSince = null
  }

  update(observation, time) {
    if (time <= this.lastTime) return { ...this.output, jump: false }
    const delta = time - this.lastTime
    this.lastTime = time
    const raw = observation?.landmarks
    const changedHand = observation?.handId && this.handId && observation.handId !== this.handId
    if (delta > settings.maximumSampleGapMs || changedHand) {
      this.clearObservation()
      this.candidate = this.gesture
      this.candidateSince = time
    }
    const valid = raw && fingers.every(finger => settings.joints[finger].every(index => {
      const point = raw[index]
      return point && Number.isFinite(point.x + point.y + (point.z ?? 0))
    })) && raw[settings.joints.wrist]
    if (!valid) {
      this.clearObservation()
      this.transition(GESTURE.IDLE, time)
      const hand = time - this.lastHandSeen <= settings.follow.dropoutMs ? this.output.hand : null
      return this.output = { gesture: this.gesture, energy: 0, extensions: null, jump: false, category: null, hand }
    }

    this.handId = observation.handId || this.handId
    const aspect = observation.aspect || 1
    const alpha = 1 - Math.exp(-delta / settings.smoothingMs)
    this.filtered = raw.map((point, index) => {
      const x = point.x * aspect, y = point.y, z = (point.z ?? 0) * aspect
      const previous = this.filtered?.[index]
      return previous ? { x: mix(previous.x, x, alpha), y: mix(previous.y, y, alpha), z: mix(previous.z, z, alpha) } : { x, y, z }
    })
    const joints = settings.joints
    const wrist = this.filtered[joints.wrist]
    const middleBase = this.filtered[joints.palm]
    const palm = Math.max(settings.minimumPalm, distance(wrist, middleBase))
    const point = { x: (wrist.x + middleBase.x) / (2 * aspect), y: (wrist.y + middleBase.y) / 2 }
    const follow = settings.follow
    if (!this.handOrigin || time - this.lastHandSeen > follow.reacquireMs ||
        (changedHand && planar(point, this.lastPalm) > follow.handSwitchDistance)) this.handOrigin = point
    this.lastHandSeen = time
    this.lastPalm = point
    // The camera preview is mirrored, so a move to the viewer's right decreases the raw camera x.
    const hand = {
      x: handAxis(this.handOrigin.x - point.x, follow.horizontalRange),
      y: handAxis(this.handOrigin.y - point.y, follow.verticalRange),
      point,
    }
    const tip = [this.filtered[joints.index.at(-1)], this.filtered[joints.middle.at(-1)]]
    const extensions = Object.fromEntries(fingers.map(finger => [finger, extension(this.filtered, finger)]))
    const twoFingers = extensions.index >= settings.fingerStraight && extensions.middle >= settings.fingerStraight &&
      extensions.ring <= settings.fingerFolded && extensions.pinky <= settings.fingerFolded
    const label = observation.category?.score >= settings.categoryConfidence ? observation.category.categoryName : null
    const thumb = label === settings.labels.stop
    const spread = planar(...tip) / palm >= settings.victorySpread
    const victory = label === settings.labels.jump && spread
    this.thumbSince = thumb ? this.thumbSince ?? time : null
    this.victorySince = victory ? this.victorySince ?? time : null
    // A dropped Victory label cannot re-arm a V sign that remains held.
    this.releaseSince = victory || (twoFingers && spread) ? null : this.releaseSince ?? time
    if (this.releaseSince !== null && time - this.releaseSince >= settings.hysteresisMs) this.jumpLatched = false

    this.history.push({ time, tip, palm, y: tip.map(point => (point.y - wrist.y) / palm), victory, twoFingers })
    const cutoff = time - Math.max(settings.stillWindowMs, settings.runWindowMs)
    while (this.history.length > 1 && this.history[1].time <= cutoff) this.history.shift()
    const energy = runningEnergy(windowAt(this.history, time, settings.runWindowMs, sample => sample.twoFingers))
    const stop = this.thumbSince !== null && time - this.thumbSince >= settings.stopHoldMs
    const canJump = !thumb && !this.jumpLatched && time - this.lastJump >= settings.jumpCooldownMs &&
      this.victorySince !== null && time - this.victorySince >= settings.hysteresisMs &&
      stationary(windowAt(this.history, time, settings.stillWindowMs, sample => sample.victory))
    const run = twoFingers && energy >= (this.gesture === GESTURE.RUN ? settings.exitEnergy : settings.minEnergy)
    let jump = false
    if (stop) this.transition(GESTURE.STOP, time, true)
    else if (canJump && this.gesture !== GESTURE.STOP) {
      this.transition(GESTURE.JUMP, time, true)
      this.lastJump = time
      this.jumpLatched = jump = true
    } else this.transition(run ? GESTURE.RUN : GESTURE.IDLE, time)
    return this.output = { gesture: this.gesture, energy, extensions, jump, category: label, hand }
  }
}

import { FACE_OVAL } from './face-oval.ts'

export type Point = { x: number; y: number }
type Landmark = Point & { z?: number }
type LowerLid = Point & { span: number }
export type FaceFrame = {
  center: Point
  right: Point
  down: Point
  width: number
  height: number
  eyes: LowerLid[]
  outline: Point[]
}
export type Mark = { point: Point; strength: number; time: number }
export type Impact = { point: Point; direction: Point; strength: number; time: number }
export const impactLifetime = 790
export const maxImpacts = 3
const handGrace = 145

export function reboundAt(ageMs: number) {
  if (ageMs < 0 || ageMs >= impactLifetime) return null
  const t = ageMs / 1000
  const end = Math.min(1, (impactLifetime - ageMs) / 160)
  return {
    compression: Math.exp(-6.4 * t) * Math.sin(27.5 * t + .60) * end,
    radius: .07 + 1.05 * t,
    wave: Math.exp(-4.8 * t) * end,
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const average = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function facePoint(face: FaceFrame, point: Point): Point {
  const x = (point.x - face.center.x) / face.width, y = (point.y - face.center.y) / face.width
  return { x: x * face.right.x + y * face.right.y, y: x * face.down.x + y * face.down.y }
}

export function faceFrame(points: Point[], aspect: number): FaceFrame | null {
  const required = [10, 152, 234, 454, 33, 133, 263, 362, 145, 374]
  const valid = (index: number) => !!points[index] && Number.isFinite(points[index]!.x + points[index]!.y)
  if (!required.every(valid)) return null
  const at = (i: number) => ({ x: points[i]!.x * aspect, y: points[i]!.y })
  const [left, right] = [at(234), at(454)].sort((a, b) => a.x - b.x)
  const width = Math.hypot(right!.x - left!.x, right!.y - left!.y)
  if (width < .04) return null
  const axis = { x: (right!.x - left!.x) / width, y: (right!.y - left!.y) / width }
  const down = { x: -axis.y, y: axis.x }
  const center = average(at(10), at(152))
  const height = Math.hypot(at(10).x - at(152).x, at(10).y - at(152).y) / width
  const frame: FaceFrame = {
    center, right: axis, down, width, height: clamp(height, .95, 2.1), eyes: [],
    outline: FACE_OVAL.every(valid) ? FACE_OVAL.map(at) : [],
  }
  frame.eyes = [[33, 133, 145], [263, 362, 374]].map(([a, b, lower]) => {
    const outer = at(a!), inner = at(b!)
    const mid = facePoint(frame, average(outer, inner))
    const rim = facePoint(frame, at(lower!))
    const span = clamp(Math.hypot(outer.x - inner.x, outer.y - inner.y) / width * .61, .065, .17)
    return { x: mid.x * .65 + rim.x * .35, y: Math.max(mid.y, rim.y) + .004, span }
  })
  return frame
}

export function fistCenter(hand: Landmark[], aspect: number): Point | null {
  for (let i = 0; i < 21; i++) {
    const point = hand[i]
    if (!point || !Number.isFinite(point.x + point.y + (point.z ?? 0))) return null
  }
  const distance = (a: Landmark, b: Landmark) => Math.hypot((a.x - b.x) * aspect, a.y - b.y, ((a.z ?? 0) - (b.z ?? 0)) * aspect)
  const palm = Math.max(distance(hand[5]!, hand[17]!), distance(hand[0]!, hand[9]!) * .86)
  if (palm < .019) return null
  let folded = 0
  for (const base of [5, 9, 13, 17]) {
    const root = hand[base]!, joint = hand[base + 1]!, end = hand[base + 3]!
    // A straight finger has root-to-tip length close to the sum of the two spans.
    const ratio = distance(root, end) / Math.max(.001, distance(root, joint) + distance(joint, end))
    if (ratio < .77 || (ratio < .92 && distance(end, hand[0]!) < distance(joint, hand[0]!) - palm * .12)) folded++
  }
  if (folded < 3) return null
  const knuckle = average(hand[5]!, hand[17]!)
  const fingers = average(hand[6]!, hand[18]!)
  return { x: (knuckle.x * .6 + fingers.x * .4) * aspect, y: knuckle.y * .6 + fingers.y * .4 }
}

const maxMarks = 8
type HandHistory = { point: Point; armed: boolean; timestamp: number; lastHit: number }

export class FaceReaction {
  hits = 0
  readonly marks: Mark[] = []
  readonly impacts: Impact[] = []
  private hands = new Map<string, HandHistory>()
  private lastHit = -Infinity

  punch(id: string, point: Point | null, face: FaceFrame, timestamp: number, effectTime = timestamp) {
    if (!point) {
      this.hands.delete(id)
      return false
    }
    const local = facePoint(face, point)
    const scaleY = face.height * .66
    const scaleX = .78
    const radius = (p: Point) => Math.hypot(p.x / scaleX, p.y / scaleY)
    const previous = this.hands.get(id)
    const fresh = previous && timestamp > previous.timestamp && timestamp - previous.timestamp <= handGrace
    const armed = radius(local) > 1.18 || (fresh && previous.armed)
    const state = { point: local, armed: Boolean(armed), timestamp, lastHit: previous?.lastHit ?? -Infinity }
    this.hands.set(id, state)
    if (!fresh || !previous.armed || timestamp - this.lastHit < 115 || timestamp - state.lastHit < 170) return false

    const elapsed = Math.max(.016, (timestamp - previous.timestamp) / 1000)
    const dx = (local.x - previous.point.x) / scaleX, dy = (local.y - previous.point.y) / scaleY
    const lengthSquared = dx * dx + dy * dy
    const t = clamp(-(previous.point.x / scaleX * dx + previous.point.y / scaleY * dy) / Math.max(.00001, lengthSquared), 0, 1)
    const nearest = { x: previous.point.x + (local.x - previous.point.x) * t, y: previous.point.y + (local.y - previous.point.y) * t }
    const closing = radius(previous.point) - radius(nearest)
    // A sweep can pass entirely through the trigger zone between camera frames.
    const speed = closing / elapsed
    if (radius(nearest) > 1 || speed < 1.65) return false

    state.armed = false
    state.lastHit = this.lastHit = timestamp
    const innerRadius = Math.hypot(nearest.x / .41, nearest.y / (face.height * .41))
    const scale = 1 / Math.max(1, innerRadius)
    const contact = { x: nearest.x * scale, y: nearest.y * scale }
    const localMotion = { x: local.x - previous.point.x, y: local.y - previous.point.y }
    const distance = Math.hypot(localMotion.x, localMotion.y)
    this.impacts.push({
      point: contact,
      direction: { x: localMotion.x / distance, y: localMotion.y / distance },
      strength: clamp(.48 + speed * .054, .58, 1),
      time: effectTime,
    })
    if (this.impacts.length > maxImpacts) this.impacts.shift()
    this.addMark(contact, effectTime)
    return true
  }

  private addMark(point: Point, time: number) {
    this.hits++
    const existing = this.marks.find(mark => Math.hypot(mark.point.x - point.x, mark.point.y - point.y) < .14)
    if (existing) {
      existing.strength = Math.min(1, existing.strength + .26)
      existing.time = time
      return
    }
    if (this.marks.length === maxMarks) {
      const oldest = this.marks.reduce((a, b) => a.time < b.time ? a : b)
      this.marks.splice(this.marks.indexOf(oldest), 1)
    }
    this.marks.push({ point, strength: .48, time })
  }

  retain(seen: Set<string>, timestamp: number) {
    for (const [id, history] of this.hands) {
      if (!seen.has(id) && timestamp - history.timestamp > handGrace) this.hands.delete(id)
    }
  }

  moving(now: number) {
    return this.impacts.some(impact => now - impact.time < impactLifetime)
  }

  clearHands() { this.hands.clear() }

  reset() {
    this.hits = 0
    this.marks.length = 0
    this.impacts.length = 0
    this.lastHit = -Infinity
    this.clearHands()
  }
}

export function fatigue(hits: number) {
  return { hollow: 1 - Math.exp(-hits / 6), shadows: 1 - Math.exp(-Math.max(0, hits - 1) / 3.4) }
}

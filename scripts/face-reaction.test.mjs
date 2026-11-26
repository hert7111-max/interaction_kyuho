import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FaceReaction, fatigue, fistCenter, facePoint, reboundAt, impactLifetime } from '../src/face-reaction-engine.ts'

const face = { center: { x: 0, y: 0 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, width: 1, height: 1.5, eyes: [] }
const point = (x, y = .2) => ({ x, y })
function hand(closed) {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .5 }))
  points[0] = { x: .5, y: .59 }
  for (const [f, base] of [5, 9, 13, 17].entries()) {
    const x = .46 + .025 * f
    for (let i = 0; i < 4; i++) points[base + i] = {
      x, y: closed ? [.5, .468, .48, .519][i] : .5 - .031 * i,
    }
  }
  return points
}

test('Only a folded fist approaches the target and the hit can register outside the face', () => {
  assert.equal(fistCenter(hand(false), 1.5), null)
  assert.ok(fistCenter(hand(true), 1.5))
  const engine = new FaceReaction()
  assert.equal(engine.punch('left', point(1.02), face, 100), false)
  assert.equal(engine.punch('left', point(.69), face, 180), true)
  assert.equal(engine.hits, 1)
  assert.ok(engine.marks[0].point.x > .35 && engine.marks[0].point.x < .42)
  assert.equal(engine.punch('left', point(.4), face, 240), false)
  assert.equal(engine.punch('left', point(.39), face, 700), false)
})

test('Slow motion and absent hands cannot hit, retraction allows a new strike with increasing effects', () => {
  const engine = new FaceReaction()
  engine.punch('left', point(1.1), face, 0)
  engine.retain(new Set(), 150)
  assert.equal(engine.punch('left', point(.69), face, 166), false)
  engine.punch('left', point(.98), face, 510)
  engine.punch('left', point(.86), face, 710)
  assert.equal(engine.punch('left', point(.75), face, 910), false)
  for (let i = 0; i < 14; i++) {
    const start = 1000 + i * 400
    engine.punch('left', point(1.02), face, start)
    assert.equal(engine.punch('left', point(.69), face, start + 70), true)
  }
  assert.equal(engine.hits, 14)
  assert.equal(engine.marks.length, 1)
  assert.equal(engine.marks[0].strength, 1)
  assert.ok(fatigue(engine.hits).hollow > .88 && fatigue(engine.hits).shadows > .90)
  engine.reset()
  assert.deepEqual(fatigue(engine.hits), { hollow: 0, shadows: 0 })
  assert.equal(engine.marks.length, 0)
})

test('Face coordinates track translation and roll', () => {
  const rotated = { ...face, center: point(.4, .7), right: point(0, 1), down: point(-1, 0), width: .2 }
  const local = facePoint(rotated, point(.44, .78))
  assert.ok(Math.abs(local.x - .4) < 1e-12 && Math.abs(local.y + .2) < 1e-12)
})

test('A fast sweep registers through the trigger zone even if a camera frame is missed', () => {
  const engine = new FaceReaction()
  engine.punch('right', point(1.12, .27), face, 100)
  engine.retain(new Set(), 133)
  assert.equal(engine.punch('right', point(-1.14, .27), face, 164, 188), true)
  assert.equal(engine.hits, 1)
  assert.equal(engine.impacts.length, 1)
  assert.equal(engine.impacts[0].time, 188)
  assert.ok(engine.impacts[0].direction.x < -.99 && engine.impacts[0].strength > .9)
  engine.punch('left', point(-1.1, -.12), face, 260)
  assert.equal(engine.punch('left', point(-.67, -.12), face, 305), true)
  assert.equal(engine.hits, 2)
})

test('Rubber motion reverses direction and decays while its ripple travels outward', () => {
  const push = reboundAt(32), recoil = reboundAt(151), late = reboundAt(750)
  assert.ok(push.compression > .55)
  assert.ok(recoil.compression < -.30)
  assert.ok(recoil.radius > push.radius && late.radius > recoil.radius)
  assert.ok(late.wave < .02)
  assert.equal(reboundAt(impactLifetime), null)
  const engine = new FaceReaction()
  engine.punch('right', point(1.08), face, 70)
  engine.punch('right', point(.69), face, 110, 125)
  assert.ok(engine.moving(260))
  assert.equal(engine.moving(125 + impactLifetime), false)
  engine.reset()
  assert.equal(engine.impacts.length, 0)
})

test('High-rate tracking runs hands on every frame and only ships new face landmarks', async () => {
  const { runInNewContext } = await import('node:vm')
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../public/rubber-runtime.js', import.meta.url), 'utf8')
  let handCalls = 0, faceCalls = 0
  const self = {}
  class PapaVisionRuntime {
    async init() {
      this.hands = { detectForVideo: () => { handCalls++; return { landmarks: [], handedness: [] } } }
      this.face = { detectForVideo: () => { faceCalls++; return { faceLandmarks: [[{ x: 0, y: 0 }]] } } }
    }
  }
  runInNewContext(source, { self, PapaVisionRuntime, performance })
  const runtime = new self.RubberVisionRuntime()
  await runtime.init('/', { fastHands: true })
  const packets = [0, 17, 33, 50, 67, 83].map(timestamp => runtime.detect({}, timestamp))
  assert.equal(handCalls, 6)
  assert.equal(faceCalls, 2)
  assert.equal(packets[0].faceTimestamp, 0)
  assert.equal(packets[1].face, null)
  assert.equal(packets[5].faceTimestamp, 83)
  const slower = [243, 410, 570, 735].map(timestamp => runtime.detect({}, timestamp))
  assert.equal(slower[0].face, null)
  assert.equal(slower[1].faceTimestamp, 410)
  assert.equal(slower[2].face, null)
  assert.equal(slower[3].faceTimestamp, 735)
})

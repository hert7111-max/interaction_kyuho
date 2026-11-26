import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OverheadClap } from '../src/invisible-clap.ts'

function pose(gap, handY = .2, offset = 0, tracked = true) {
  const points = []
  points[0] = { x: .5 + offset, y: .32 }
  points[11] = { x: .38 + offset, y: .49 }
  points[12] = { x: .62 + offset, y: .49 }
  points[15] = { x: .5 + offset - gap / 2, y: handY, visibility: tracked ? 1 : .1 }
  points[16] = { x: .5 + offset + gap / 2, y: handY }
  return points
}

test('An overhead clap needs open then closed hands, and is triggered once until the hands reopen', () => {
  const detector = new OverheadClap()
  assert.equal(detector.update([pose(.03)], 16 / 9, 100), false)
  assert.equal(detector.update([pose(.23)], 16 / 9, 180), false)
  assert.equal(detector.update([pose(.04)], 16 / 9, 255), true)
  assert.equal(detector.update([pose(.03)], 16 / 9, 1200), false)
  assert.equal(detector.update([pose(.22)], 16 / 9, 1300), false)
  assert.equal(detector.update([pose(.04)], 16 / 9, 1400), true)
})

test('Claps below the head, missing wrists, and stale tracking do not trigger', () => {
  const detector = new OverheadClap()
  assert.equal(detector.update([pose(.23, .38)], 1, 0), false)
  assert.equal(detector.update([pose(.03, .38)], 1, 100), false)
  assert.equal(detector.update([pose(.23)], 1, 200), false)
  assert.equal(detector.update([pose(.03, .2, 0, false)], 1, 300), false)
  assert.equal(detector.update([pose(.03)], 1, 390), false)
  assert.equal(detector.update([pose(.23)], 1, 450), false)
  assert.equal(detector.update([pose(.03)], 1, 1800), false)
})

test('Pose order changes do not combine one person’s open hands with another’s closed hands', () => {
  const detector = new OverheadClap()
  assert.equal(detector.update([pose(.22, .2, -.25), pose(.025, .2, .25)], 1.5, 0), false)
  assert.equal(detector.update([pose(.025, .2, .25), pose(.22, .2, -.25)], 1.5, 100), false)
  assert.equal(detector.update([pose(.025, .2, .25), pose(.035, .2, -.25)], 1.5, 200), true)
})

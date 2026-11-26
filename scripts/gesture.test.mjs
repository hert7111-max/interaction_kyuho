import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG } from '../src/config.js'
import { GESTURE, GestureDetector } from '../src/gesture.js'
import { CharacterMotion } from '../src/character-scan/character-motion.js'

function hand(time, { label = 'Victory', amplitude = 0, folded = false, sameDirection = false, slide = 0, shiftX = 0 } = {}) {
  const unit = .13
  const point = (x, y) => ({ x: .5 + x * unit + shiftX, y: .70 + (y + slide) * unit, z: 0 })
  const points = Array.from({ length: 21 }, () => point(0, 0))
  const fingers = CONFIG.gesture.joints
  const wave = Math.sin(time / 1000 * Math.PI * 8) * amplitude
  const straight = ([root, pip, dip, tip], baseX, baseY, x, y) => {
    for (const [i, index] of [root, pip, dip, tip].entries()) points[index] = point(baseX + (x - baseX) * i / 3, baseY + (y - baseY) * i / 3)
  }
  const curl = ([root, pip, dip, tip], x, y) => {
    points[root] = point(x, y)
    points[pip] = point(x, y - .30)
    points[dip] = point(x + .10, y - .13)
    points[tip] = point(x + .07, y + .01)
  }
  if (folded) {
    curl(fingers.index, -.32, -.70)
    curl(fingers.middle, -.04, -.82)
  } else {
    straight(fingers.index, -.32, -.70, -.75, -1.78 + wave)
    straight(fingers.middle, -.04, -.82, .36, -1.84 + (sameDirection ? wave : -wave))
  }
  curl(fingers.thumb, -.40, -.39)
  curl(fingers.ring, .20, -.70)
  curl(fingers.pinky, .42, -.62)
  return { landmarks: points, category: { categoryName: label, score: .99 }, handId: 'Right', aspect: 1 }
}

function frames(detector, from, to, options) {
  const states = []
  for (let i = from; i <= to; i += 25) states.push(detector.update(hand(i, options), i))
  return states
}

test('Thumb_Up takes priority after 200ms and release is debounced for 200ms', () => {
  const detector = new GestureDetector()
  const thumb = { label: 'Thumb_Up', amplitude: .28 }
  assert.equal(frames(detector, 0, 175, thumb).at(-1).gesture, GESTURE.IDLE)
  assert.equal(detector.update(hand(200, thumb), 200).gesture, GESTURE.STOP)
  assert.equal(frames(detector, 225, 400, { label: 'None', folded: true }).at(-1).gesture, GESTURE.STOP)
  assert.equal(detector.update(hand(425, { label: 'None', folded: true }), 425).gesture, GESTURE.IDLE)
})

test('A still Victory jumps once and requires cooldown plus a visibly released shape', () => {
  const detector = new GestureDetector()
  assert.equal(frames(detector, 0, 275).some(state => state.jump), false)
  assert.equal(detector.update(hand(300), 300).jump, true)
  assert.equal(frames(detector, 325, 850, { label: 'None' }).some(state => state.jump), false)
  assert.equal(frames(detector, 875, 1300).some(state => state.jump), false)
  frames(detector, 1325, 1650, { label: 'Open_Palm', folded: true })
  const again = frames(detector, 1675, 2225)
  assert.equal(again.filter(state => state.jump).length, 1)

  const cooldown = new GestureDetector()
  frames(cooldown, 0, 300)
  frames(cooldown, 325, 550, { label: 'None', folded: true })
  assert.equal(frames(cooldown, 575, 875).some(state => state.jump), false)
  assert.equal(cooldown.update(hand(900), 900).jump, true)
})

test('Counter-moving fingers run, same-direction motion and camera-hand translation stay idle', () => {
  const fast = new GestureDetector(), steady = new GestureDetector(), offset = new GestureDetector()
  const slow = new GestureDetector()
  const high = frames(fast, 0, 1100, { amplitude: .30 }).at(-1)
  const low = frames(slow, 0, 1100, { amplitude: .13 }).at(-1)
  assert.equal(high.gesture, GESTURE.RUN)
  assert.ok(high.energy > low.energy && high.energy <= 1 && low.energy > 0)
  assert.ok(high.extensions.index > .95 && high.extensions.ring < .3)
  assert.equal(frames(steady, 0, 1100, { amplitude: .25, sameDirection: true }).at(-1).gesture, GESTURE.IDLE)
  let last
  for (let t = 0; t <= 1100; t += 25) last = offset.update(hand(t, { label: 'None', slide: Math.sin(t / 70) * .30 }), t)
  assert.equal(last.gesture, GESTURE.IDLE)
  assert.equal(last.energy, 0)
})

test('An unclassified hand yields mirrored motion, tolerates a short drop, and recalibrates on return', () => {
  const detector = new GestureDetector()
  const neutral = { label: 'None', folded: true }
  const shifted = { ...neutral, shiftX: -.14, slide: -.8 }
  assert.equal(detector.update(hand(0, neutral), 0).hand.x, 0)
  const movement = frames(detector, 25, 200, shifted).at(-1)
  assert.equal(movement.gesture, GESTURE.IDLE)
  assert.ok(movement.hand.x > .4 && movement.hand.y > .35)
  assert.deepEqual(detector.update(null, 240).hand, movement.hand)
  assert.equal(detector.update(null, 350).hand, null)
  const resumed = detector.update(hand(475, shifted), 475)
  assert.ok(resumed.hand.x > .4)
  const newOrigin = detector.update(hand(950, shifted), 950)
  assert.equal(newOrigin.hand.x, 0)
  assert.equal(newOrigin.hand.y, 0)
})

test('Hand movement visibly poses the character and eases out after hand loss or a stop', () => {
  const motion = new CharacterMotion()
  const idle = { gesture: GESTURE.IDLE, energy: 0 }
  motion.update(0, idle)
  let pose
  for (let time = 25; time <= 250; time += 25) pose = motion.update(time, { ...idle, hand: { x: .8, y: .8 } })
  assert.equal(pose.state, GESTURE.FOLLOW)
  assert.ok(pose.side > .2 && pose.tilt < 0 && pose.handLift > .5 && pose.handSpread > .4)
  for (let time = 275; time <= 500; time += 25) pose = motion.update(time, { ...idle, hand: { x: -.8, y: -.8 } })
  assert.ok(pose.side < -.2 && pose.scaleY < .93 && pose.handLift === 0)
  const ease = motion.update(525, idle)
  assert.ok(ease.handMoving && ease.side > pose.side && ease.side < 0)
  for (let time = 550; time <= 1025; time += 25) {
    pose = motion.update(time, { gesture: GESTURE.STOP, energy: 0, hand: { x: 1, y: 1 } })
  }
  assert.equal(pose.side, 0)
  assert.equal(pose.state, GESTURE.STOP)
  assert.equal(pose.handLift, 0)
})

test('Running speed follows gesture energy and STOP brakes over 300ms', () => {
  const slow = new CharacterMotion(), fast = new CharacterMotion()
  for (let t = 0; t <= 750; t += 25) {
    slow.update(t, { gesture: GESTURE.RUN, energy: .4 })
    fast.update(t, { gesture: GESTURE.RUN, energy: 1 })
  }
  assert.ok(Math.abs(slow.speed / fast.speed - .4) < 1e-6)
  assert.ok(fast.distance > slow.distance)
  for (let t = 775; t < 975; t += 25) fast.update(t, { gesture: GESTURE.RUN, energy: 0 })
  assert.ok(fast.speed > CONFIG.motion.maxSpeed * .99)
  const speed = fast.speed
  const lean = fast.update(975, { gesture: GESTURE.STOP, energy: 1 }).lean
  const distance = fast.distance
  const half = fast.update(1125, { gesture: GESTURE.STOP, energy: 1 })
  assert.equal(half.state, GESTURE.STOP)
  assert.equal(fast.speed, speed / 2)
  assert.ok(half.lean > lean && fast.distance > distance)
  const stopped = fast.update(1275, { gesture: GESTURE.STOP, energy: 1 })
  assert.equal(fast.speed, 0)
  assert.ok(Math.abs(stopped.lean) < 1e-6)
  assert.equal(fast.update(1300, { gesture: GESTURE.STOP, energy: 1 }).distance, stopped.distance)
})

test('Jump follows a parabola, shrinks its shadow, and ends after landing squash', () => {
  const motion = new CharacterMotion()
  const config = CONFIG.motion
  const idle = { gesture: GESTURE.IDLE, energy: 0 }
  motion.update(0, { gesture: GESTURE.JUMP, energy: 0, jump: true })
  assert.equal(motion.update(config.jumpDurationMs / 4, idle).height, config.jumpHeight * .75)
  const apex = motion.update(config.jumpDurationMs / 2, idle)
  assert.equal(apex.state, GESTURE.JUMP)
  assert.equal(apex.height, config.jumpHeight)
  assert.equal(apex.shadowScale, config.jumpShadowScale)
  const squash = motion.update(config.jumpDurationMs + config.landingDurationMs * config.landingPeak, idle)
  assert.equal(squash.state, GESTURE.JUMP)
  assert.equal(squash.height, 0)
  assert.ok(squash.scaleY < 1 && squash.scaleXZ > 1)
  assert.equal(squash.shadowScale, 1)
  const rest = motion.update(config.jumpDurationMs + config.landingDurationMs, idle)
  assert.equal(rest.state, GESTURE.IDLE)
  assert.equal(rest.scaleY, 1)
  assert.notEqual(motion.update(config.jumpDurationMs + config.landingDurationMs + 50, idle).height, rest.height)
})

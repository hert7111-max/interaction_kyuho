import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, runInContext } from 'node:vm'

// Exercise the real SVG handlers with a virtual clock, including gaze-lock timing.
let time = 0
const elements = new Map(), windowEvents = new Map(), documentEvents = new Map()
const makeElement = () => {
  const classes = new Set()
  return { attrs: new Map(), listeners: new Map(), textContent: '', innerHTML: '', style: { setProperty() {} }, classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    setAttribute(name, value) { this.attrs.set(name, value) }, addEventListener(name, fn) { this.listeners.set(name, fn) },
    getBoundingClientRect() { return { left: 400, top: 180, width: 480, height: 480 } } }
}
const element = id => { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id) }
const sandbox = {
  document: { querySelector: element, documentElement: element('root'), hidden: false, addEventListener: (name, fn) => documentEvents.set(name, fn) },
  performance: { now: () => time }, matchMedia: () => ({ matches: false }), requestAnimationFrame() {}, Math,
  addEventListener: (name, fn) => windowEvents.set(name, fn),
}
sandbox.window = sandbox
const context = createContext(sandbox)
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './style.css'", '')
runInContext(stripTypeScriptTypes(source, { mode: 'strip' }), context)
const inspect = value => runInContext(value, context)
const state = () => sandbox.__slowbro
const frames = (duration, interval = 1000 / 60) => { const end = time + duration; while (time < end) { time = Math.min(end, time + interval); inspect('animate(performance.now())') } }
const pointer = (name, x, y, extra = {}) => windowEvents.get(name)({ clientX: x, clientY: y, pointerType: 'mouse', button: 0, target: { closest: () => null }, preventDefault() {}, ...extra })
const reset = () => { element('#reset').listeners.get('click')(); frames(800) }

pointer('pointermove', 1080, 100)
const target = { ...state().target }
assert.ok(target.x > 0 && target.y < 0)
frames(16)
assert.ok(state().gaze.x > 0 && state().gaze.x < target.x, 'Face eases instead of snapping')
assert.ok(state().pupils.x > state().gaze.x, 'Eyes lead the head')
frames(900)
assert.ok(Math.abs(state().gaze.x - target.x) < .01)
assert.ok(Math.abs(state().gaze.y - target.y) < .01)
assert.ok(element('#head').attrs.get('transform').includes('rotate('))
assert.ok(element('#features').attrs.get('transform').includes('translate('))
console.log('✓ Eyes and facial features follow the pointer smoothly; eyes lead the head')

for (const [x, y] of [[-10000, -10000], [10000, -10000], [10000, 10000], [-10000, 10000]]) {
  pointer('pointermove', x, y); frames(600)
  assert.ok(Math.hypot(state().target.x, state().target.y) <= 1.00001)
  const { x: px, y: py } = state().pupils
  assert.ok((px * 15 / 25) ** 2 + (py * 25 / 44) ** 2 < 1, 'Pupils stay inside eye whites')
}
console.log('✓ Gaze stays bounded at all four screen corners')

reset()
pointer('pointerdown', 1050, 420)
assert.equal(state().winkSide, 1)
assert.equal(state().locked, true)
frames(180)
assert.ok(state().rightOpen < .08)
assert.equal(state().leftOpen, 1, 'Only one eye closes for a wink')
pointer('pointermove', 0, 420)
assert.ok(state().target.x > 0, 'Wink initially holds the clicked point')
frames(300)
assert.ok(state().target.x < 0, 'Tracking resumes after a short hold')
frames(500)
assert.equal(state().rightOpen, 1)
assert.equal(state().leftOpen, 1)
assert.equal(element('#orb').classList.contains('is-winking'), false)
pointer('pointerdown', 0, 420); frames(180)
assert.equal(state().winkSide, 0)
assert.ok(state().leftOpen < .08)
assert.equal(state().rightOpen, 1)
// Repeated clicks must retarget and restart the wink immediately.
pointer('pointerdown', 1100, 420); frames(180)
assert.equal(state().winkSide, 1)
assert.ok(state().rightOpen < .08)
assert.equal(state().leftOpen, 1)
console.log('✓ Click looks at that point and winks; repeated clicks and gaze locking behave correctly')

reset()
pointer('pointerdown', 1050, 420)
assert.equal(state().mouthOpen, 1, 'Mouth starts open before animation')
frames(70)
assert.ok(state().mouthOpen > .02 && state().mouthOpen < 1, 'Jaw closes gradually')
frames(200)
assert.ok(state().mouthOpen <= .021, 'Mouth reaches a fully closed pose')
assert.ok(Number(element('#mouth-seam').attrs.get('opacity')) > .95, 'Closed lips replace the open cavity')
assert.ok(element('#lower-jaw').attrs.get('transform').includes('scale(1 0.02)'), 'The lower jaw visibly moves up')
frames(280)
assert.ok(state().mouthOpen > .02 && state().mouthOpen < 1, 'Jaw reopens gradually')
pointer('pointerdown', 0, 420)
frames(270)
assert.ok(state().mouthOpen <= .021, 'Repeated click restarts the mouth gesture')
frames(700)
assert.equal(state().mouthOpen, 1)
assert.equal(Number(element('#mouth-seam').attrs.get('opacity')), 0)
assert.equal(state().leftOpen, 1)
assert.equal(state().rightOpen, 1)
console.log('✓ Click closes the lower jaw, holds closed lips, then reopens; repeated clicks recover cleanly')

reset()
pointer('pointerdown', 300, 600, { pointerType: 'touch' })
assert.equal(state().touching, true)
frames(120)
assert.ok(state().target.x < 0 && state().target.y > 0)
assert.ok(state().mouthOpen < 1, 'Touch also animates the mouth')
pointer('pointermove', 1000, 200, { pointerType: 'touch' })
frames(400)
assert.ok(state().target.x > 0 && state().target.y < 0)
pointer('pointerup', 1000, 200, { pointerType: 'touch' })
frames(2900)
assert.ok(Math.hypot(state().gaze.x, state().gaze.y) < .001, 'Touch returns to center after release')
pointer('pointerdown', 0, 0, { pointerType: 'touch' })
windowEvents.get('pointercancel')()
assert.equal(state().touching, false)
assert.equal(state().target.x, 0)
console.log('✓ Touch looks and winks, follows finger movement, and returns to center')

reset()
const key = key => element('#orb').listeners.get('keydown')({ key, repeat: false, preventDefault() {} })
key('ArrowRight'); key('ArrowUp')
assert.ok(state().target.x > 0 && state().target.y < 0)
const before = state().winkCount
key('Enter'); assert.equal(state().winkCount, before + 1)
key('Home'); assert.equal(state().target.x, 0)
const after = state().winkCount
pointer('pointerdown', 100, 100, { button: 2 })
pointer('pointerdown', 100, 100, { target: { closest: () => ({}) } })
assert.equal(state().winkCount, after, 'Secondary clicks and controls do not cause duplicate winks')
element('#wink').listeners.get('click')(); assert.equal(state().winkCount, after + 1)
windowEvents.get('blur')(); assert.equal(state().target.x, 0)
console.log('✓ Keyboard navigation, wink control, reset, and blur work without duplicate clicks')

reset()
inspect('nextBlink = performance.now()'); frames(50)
assert.ok(state().leftOpen < .1 && state().rightOpen < .1)
frames(250)
assert.equal(state().leftOpen, 1); assert.equal(state().rightOpen, 1)
assert.equal(state().mouthOpen, 1, 'Automatic blinking does not close the mouth')
for (const [id, node] of elements) for (const value of node.attrs.values()) assert.ok(!/NaN|Infinity/.test(value), `${id} has finite transforms`)
console.log('✓ Automatic blinks reopen cleanly and all SVG transforms stay finite')

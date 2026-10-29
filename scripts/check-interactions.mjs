import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, runInContext } from 'node:vm'

// Execute the actual input handlers with a virtual clock and minimal DOM/canvas.
const listeners = new Map()
const drawing = new Proxy({}, { get: (_, name) => name === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true })
const surface = { width: 0, height: 0, getContext: () => drawing, setPointerCapture() {}, addEventListener: (name, fn) => listeners.set(name, fn) }
const generic = { innerHTML: '', textContent: '', hidden: false, querySelector() { return generic }, addEventListener() {}, setAttribute() {} }
let time = 0
const sandbox = { document: { querySelector: selector => selector === '#fireworks' || selector === '#stars' ? surface : generic, createElement: () => ({ ...surface }), addEventListener() {}, fullscreenEnabled: false }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2, performance: { now: () => time }, matchMedia: () => ({ matches: false }), addEventListener() {}, requestAnimationFrame() {}, Math }
sandbox.window = sandbox
const context = createContext(sandbox)
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './style.css'", '')
runInContext(stripTypeScriptTypes(source, { mode: 'strip' }), context)
const inspect = expression => runInContext(expression, context)
const reset = () => inspect('particles = []; queue = []; gestures.clear(); flashes = []; burstCount = 0')
const pointer = (name, x, y, id = 1, extra = {}) => listeners.get(name)({ clientX: x, clientY: y, pointerId: id, pointerType: 'mouse', button: 0, preventDefault() {}, ...extra })

reset()
pointer('pointerdown', 320, 240)
assert.equal(sandbox.__nightCanvas.activePointers, 1)
time = 50
pointer('pointerup', 320, 240)
assert.equal(sandbox.__nightCanvas.bursts, 1)
assert.equal(sandbox.__nightCanvas.activePointers, 0)
assert.equal(inspect('particles.every(p => p.x === 320 && p.y === 240)'), true)
const smallCount = sandbox.__nightCanvas.particles
const smallSpeed = inspect('Math.max(...particles.map(p => Math.hypot(p.vx, p.vy)))')
reset()
time = 100
pointer('pointerdown', 700, 350)
time = 2400
pointer('pointerup', 700, 350)
assert.ok(sandbox.__nightCanvas.particles > smallCount * 1.6, 'Long hold creates a larger burst')
assert.ok(inspect('Math.max(...particles.map(p => Math.hypot(p.vx, p.vy)))') > smallSpeed * 1.3, 'Long hold expands farther')
console.log('✓ Click bursts at the selected location; long hold increases particle count and expansion')

reset()
time = 3000
pointer('pointerdown', 100, 200)
pointer('pointermove', 350, 200)
pointer('pointermove', 350, 450)
time = 3800
pointer('pointerup', 600, 450)
assert.equal(sandbox.__nightCanvas.bursts, 0, 'Drag waits for release and scheduled playback')
assert.ok(sandbox.__nightCanvas.queued > 10)
assert.equal(inspect('queue[0].x === 100 && queue[0].y === 200 && queue.at(-1).x === 600 && queue.at(-1).y === 450'), true)
assert.equal(inspect('queue.every(p => (p.y === 200 && p.x <= 350) || (p.x === 350 && p.y >= 200 && p.y <= 450) || (p.y === 450 && p.x >= 350))'), true, 'Bursts follow each leg of the actual route')
assert.equal(inspect('queue.every((p,i) => i === 0 || p.at > queue[i-1].at)'), true)
inspect('draw(3801)')
assert.equal(sandbox.__nightCanvas.bursts, 1)
inspect('draw(7000)')
assert.equal(sandbox.__nightCanvas.queued, 0)
assert.ok(sandbox.__nightCanvas.bursts > 10)
console.log('✓ Drag preserves corners and endpoints, then fires sequentially along the route')

reset()
pointer('pointerdown', 100, 100, 11, { pointerType: 'touch' })
pointer('pointerdown', 800, 300, 12, { pointerType: 'touch' })
assert.equal(sandbox.__nightCanvas.activePointers, 2)
pointer('pointerup', 100, 100, 11, { pointerType: 'touch' })
pointer('pointercancel', 800, 300, 12)
assert.equal(sandbox.__nightCanvas.activePointers, 0)
assert.equal(sandbox.__nightCanvas.bursts, 1)
console.log('✓ Touch pointers are independent; cancelled gestures do not fire')
reset()
const keyboard = (name, key) => listeners.get(name)({ key, repeat: false, preventDefault() {} })
keyboard('keydown', ' ')
keyboard('keydown', 'ArrowRight')
keyboard('keyup', ' ')
assert.ok(sandbox.__nightCanvas.queued >= 2)
console.log('✓ Keyboard charging and drawing work with Space and arrow keys')
reset()
for (let i = 0; i < 100; i++) { pointer('pointerdown', 200, 200); pointer('pointerup', 200, 200) }
assert.ok(sandbox.__nightCanvas.particles <= 4200)
inspect('draw(100000)')
assert.equal(inspect('particles.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))'), true)
console.log('✓ Rapid input stays within the particle budget and renders finite positions')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, runInContext } from 'node:vm'

// Run the real handlers and audio synthesis against a virtual clock.
const listeners = new Map(), controls = new Map(), windows = new Map()
const drawing = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true })
const canvas = { getContext: () => drawing, setPointerCapture() {}, addEventListener: (key, fn) => listeners.set(key, fn) }
const generic = { innerHTML: '', textContent: '', addEventListener() {} }
const button = id => ({ ...generic, classList: { toggle() {} }, setAttribute() {}, addEventListener: (name, fn) => controls.set(`${id}:${name}`, fn) })
const sound = button('sound'), reset = button('reset')
let time = 0, bufferStarts = 0
const buffers = [], sources = []
class AudioContext {
  sampleRate = 22050
  state = 'suspended'
  destination = {}
  resume() { this.state = 'running'; return Promise.resolve() }
  createDynamicsCompressor() { return { threshold: {}, ratio: {}, connect() {} } }
  createGain() { return { gain: {}, connect() {} } }
  createBuffer(_, length) { const data = new Float32Array(length); buffers.push(data); return { getChannelData: () => data } }
  createBufferSource() { const source = { connect() {}, disconnect() {}, start() { bufferStarts++ }, onended() {} }; sources.push(source); return source }
}
const sandbox = {
  document: { activeElement: canvas, querySelector: id => ({ '#bubbles': canvas, '#sound': sound, '#reset': reset }[id] ?? generic), createElement: () => ({ getContext: () => drawing }), addEventListener() {} },
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
  performance: { now: () => time }, matchMedia: () => ({ matches: false }),
  addEventListener: (key, fn) => windows.set(key, fn), requestAnimationFrame() {}, AudioContext, Math,
}
sandbox.window = sandbox
const context = createContext(sandbox)
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './style.css'", '')
runInContext(stripTypeScriptTypes(source, { mode: 'strip' }), context)
const inspect = expression => runInContext(expression, context)
const ready = () => inspect('bubbles.forEach(b => b.poppedAt = -Infinity); drops = []; labels = []; popCount = 0; pointers.clear()')
const point = i => inspect(`({x: bubbles[${i}].x, y: bubbles[${i}].y})`)
const pointer = (name, p, id = 1, extra = {}) => listeners.get(name)({ clientX: p.x, clientY: p.y, pointerId: id, pointerType: 'mouse', button: 0, preventDefault() {}, ...extra })
const endSounds = () => { sources.splice(0).forEach(s => s.onended()) }

const first = point(0)
pointer('pointerdown', first)
assert.equal(sandbox.__bubblePop.pops, 1, 'Click pops immediately')
assert.equal(sandbox.__bubblePop.activePointers, 1)
pointer('pointerup', first)
assert.equal(sandbox.__bubblePop.pops, 1, 'Release does not duplicate a pop')
pointer('pointerdown', first); pointer('pointerup', first)
assert.equal(sandbox.__bubblePop.pops, 1, 'Deflated bubble cannot pop twice')
assert.equal(inspect('inflation(bubbles[0], 0)'), 0)
time = 2400
assert.ok(inspect('inflation(bubbles[0], performance.now())') > 0)
assert.ok(inspect('inflation(bubbles[0], performance.now())') < .96)
time = 6000
assert.equal(inspect('inflation(bubbles[0], performance.now())'), 1)
pointer('pointerdown', first); pointer('pointerup', first)
assert.equal(sandbox.__bubblePop.pops, 2, 'Reinflated bubble can pop again')
console.log('✓ Click pops once, stays deflated, gradually regrows, then becomes poppable again')

ready(); endSounds()
const cols = inspect('bubbles.filter(b => b.y === bubbles[0].y).length')
pointer('pointerdown', point(0))
pointer('pointermove', point(cols - 1))
assert.equal(sandbox.__bubblePop.pops, cols, 'Fast drag hits every crossed bubble')
pointer('pointermove', point(cols * 2 - 1))
assert.equal(sandbox.__bubblePop.pops, cols + 1, 'Drag follows corners')
pointer('pointerup', point(cols * 2 - 1))
assert.equal(sandbox.__bubblePop.activePointers, 0)
console.log('✓ Fast drags pop every bubble along the actual path before release')

ready(); endSounds()
pointer('pointerdown', point(0), 11, { pointerType: 'touch' })
pointer('pointerdown', point(cols * 2), 12, { pointerType: 'touch' })
assert.equal(sandbox.__bubblePop.activePointers, 2)
pointer('pointermove', point(cols * 2 + 2), 12, { pointerType: 'touch' })
pointer('pointercancel', point(0), 11)
pointer('lostpointercapture', point(cols * 2 + 2), 12)
assert.equal(sandbox.__bubblePop.activePointers, 0)
assert.equal(sandbox.__bubblePop.pops, 4)
console.log('✓ Multitouch paths stay independent and cancellation clears gestures')

assert.equal(buffers.length, 3)
assert.ok(new Set(buffers.map(b => b.length)).size === 3)
for (const data of buffers) {
  assert.ok(data.some(v => Math.abs(v) > .1), 'Sound contains audible samples')
  assert.ok(data.every(v => Number.isFinite(v) && Math.abs(v) <= 1), 'Audio stays finite and unclipped')
  assert.ok(Math.abs(data.at(-1)) < .01, 'Sound fades out')
}
ready(); endSounds()
for (let i = 0; i < 120; i++) { inspect('bubbles[0].poppedAt = -Infinity'); pointer('pointerdown', first); pointer('pointerup', first); endSounds() }
assert.ok(sandbox.__bubblePop.soundPlays.every(n => n > 0), 'All three variants play')
const beforeMute = bufferStarts
controls.get('sound:click')()
ready(); pointer('pointerdown', first); pointer('pointerup', first)
assert.equal(bufferStarts, beforeMute)
assert.equal(sandbox.__bubblePop.pops, 1, 'Mute keeps visual interaction working')
controls.get('sound:click')()
console.log('✓ Three distinct sounds play randomly; mute stops audio and preserves interaction')

ready()
listeners.get('keydown')({ key: 'ArrowRight', preventDefault() {} })
listeners.get('keydown')({ key: ' ', preventDefault() {}, repeat: false })
assert.equal(sandbox.__bubblePop.pops, 1)
assert.equal(inspect('bubbles[1].poppedAt'), time)
controls.get('reset:click')()
assert.equal(sandbox.__bubblePop.pops, 0)
time += 4500
assert.equal(sandbox.__bubblePop.ready, sandbox.__bubblePop.bubbles)
console.log('✓ Keyboard navigation and reset work')

for (const [w, h] of [[390, 844], [320, 568], [844, 390], [1920, 1080]]) {
  sandbox.innerWidth = w; sandbox.innerHeight = h; windows.get('resize')()
  assert.ok(inspect('bubbles.every(b => b.x-b.radius >= 0 && b.x+b.radius <= width && b.y-b.radius >= 0 && b.y+b.radius <= height)'))
  inspect('draw(performance.now())')
}
ready()
for (let i = 0; i < 100; i++) inspect('bubbles[0].poppedAt = -Infinity; pop(bubbles[0], performance.now())')
assert.ok(sandbox.__bubblePop.particles <= 700)
assert.ok(inspect('voices <= 24'))
time += 1000; inspect('draw(performance.now())')
assert.equal(sandbox.__bubblePop.particles, 0)
console.log('✓ Mobile, landscape, and desktop grids fit; effects and concurrent sounds stay bounded')

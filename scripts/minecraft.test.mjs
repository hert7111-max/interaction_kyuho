import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Combat, centerOnPerson, equipment, maxHp } from '../src/minecraft-combat.ts'
import { sampleShards, shardLimit } from '../src/minecraft-shards.ts'

test('Hit testing uses the interpolated center of a current person mask', () => {
  const mask = { width: 4, height: 2, timestamp: 100, pixels: new Uint8Array([0, 255, 255, 0, 0, 255, 100, 0]) }
  assert.equal(centerOnPerson(mask, 150), true)
  assert.equal(centerOnPerson(mask, 601), false)
  mask.pixels.set([255, 0, 0, 255, 255, 0, 0, 255])
  assert.equal(centerOnPerson(mask, 150), false)
})

test('Each equipped weapon flashes only once at impact when the crosshair hits', () => {
  for (const weapon of equipment) {
    const combat = new Combat()
    combat.select(weapon)
    combat.attack(100, { x: .5, y: -.2 })
    assert.equal(combat.strike.weapon, weapon)
    combat.update(100 + weapon.impact - 1, true)
    assert.equal(combat.flash(100 + weapon.impact - 1), 0)
    combat.update(100 + weapon.impact, false)
    combat.update(101 + weapon.impact, true)
    assert.equal(combat.flash(101 + weapon.impact), 0)
    combat.update(100 + weapon.duration, true)
    combat.attack(1000, { x: 0, y: 0 })
    combat.update(1000 + weapon.impact, true)
    assert.ok(combat.flash(1000 + weapon.impact) > .8)
    assert.equal(combat.flash(1235 + weapon.impact), 0)
  }
})

test('Only confirmed hits remove HP, and the final hit defeats the target once until respawn', () => {
  const combat = new Combat()
  const sword = equipment[0]
  let deaths = 0
  for (let i = 0; i < 8; i++) {
    const time = 1000 * i
    combat.attack(time, { x: 0, y: 0 })
    if (combat.update(time + sword.impact, i !== 0)) deaths++
    assert.equal(combat.hp, Math.max(0, maxHp - i * sword.damage))
    combat.update(time + sword.impact + 10, true)
    assert.equal(combat.hp, Math.max(0, maxHp - i * sword.damage))
    combat.update(time + sword.duration, true)
  }
  assert.equal(deaths, 1)
  assert.equal(combat.dead, true)
  combat.cancelAttack()
  assert.equal(combat.dead, true)
  combat.reset()
  assert.equal(combat.hp, maxHp)
  assert.equal(combat.dead, false)
})

test('Block colors come from the mirrored person pixels only and the burst has a fixed budget', () => {
  const mask = { width: 4, height: 2, timestamp: 0, pixels: new Uint8Array([255,255,0,0,255,255,0,0]) }
  const colors = { width: 4, height: 2, data: new Uint8ClampedArray([
    39,28,20,255, 39,28,20,255, 2,9,220,255, 2,9,220,255,
    208,149,112,255, 208,149,112,255, 2,9,220,255, 2,9,220,255,
  ]) }
  const blocks = sampleShards(mask, colors, 1, 1)
  assert.ok(blocks.some(block => block.r === 39))
  assert.ok(blocks.some(block => block.r === 208))
  assert.ok(blocks.every(block => block.x >= .5 && block.b !== 220))
  mask.pixels.fill(255)
  assert.equal(sampleShards(mask, colors, 1, 1).length, shardLimit)
})

test('Background plate restores cached detail and does not record masked subjects', async () => {
  const { BackgroundPlate } = await import('../src/minecraft-background.ts')
  const plate = new BackgroundPlate()
  const width = 28, height = 20
  const data = new Uint8ClampedArray(width * height * 4)
  const pixels = new Uint8Array(width * height)
  for (let i = 0; i < pixels.length; i++) data.set([i % 113, 96, 130, 255], i * 4)
  const frame = { width, height, data }
  const mask = { width, height, pixels, timestamp: 1 }
  plate.observe(frame, mask)
  const center = (10 * width + 14) * 4
  const original = Array.from(data.slice(center, center + 4))
  for (let y = 5; y < 15; y++) for (let x = 8; x < 20; x++) {
    const i = y * width + x
    pixels[i] = 255
    data.set([255, 0, 0, 255], i * 4)
  }
  plate.observe(frame, mask)
  assert.deepEqual(Array.from(plate.rebuild(true).slice(center, center + 4)), original)
})

test('Unseen scenery extends texture from real background and produces an opaque fill', async () => {
  const { BackgroundPlate } = await import('../src/minecraft-background.ts')
  const plate = new BackgroundPlate()
  const width = 30, height = 24
  const pixels = new Uint8Array(width * height)
  const data = new Uint8ClampedArray(pixels.length * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    const hidden = x >= 9 && x <= 20 && y >= 5 && y <= 18
    pixels[i] = hidden ? 255 : 0
    data.set(hidden ? [250, 12, 22, 255] : [43, y < 12 ? 126 : 174, 85, 255], i * 4)
  }
  plate.observe({ width, height, data }, { width, height, pixels, timestamp: 1 })
  const restored = plate.rebuild(true)
  const top = (8 * width + 14) * 4, bottom = (15 * width + 14) * 4
  assert.equal(restored[top], 43)
  assert.equal(restored[bottom + 2], 85)
  assert.ok(restored[bottom + 1] > restored[top + 1])
  assert.ok(restored.every((channel, i) => i % 4 !== 3 || channel === 255))
})

test('The defeated silhouette follows the selected subject and leaves a separate person visible', async () => {
  const { selectSilhouette } = await import('../src/minecraft-background.ts')
  const width = 24, height = 12
  const maskWith = (...regions) => {
    const pixels = new Uint8Array(width * height)
    for (const [left, right] of regions) for (let y = 3; y < 10; y++) {
      pixels.fill(255, y * width + left, y * width + right)
    }
    return { pixels, width, height, timestamp: 0 }
  }
  const first = selectSilhouette(maskWith([0, 4], [9, 16]), null)
  assert.equal(first.pixels[6 * width + 12], 255)
  assert.equal(first.pixels[6 * width + 2], 0)
  const moved = selectSilhouette(maskWith([0, 4], [13, 19]), first)
  assert.equal(moved.pixels[6 * width + 17], 255)
  assert.ok(selectSilhouette(maskWith([0, 4]), moved).pixels.every(value => value === 0))
})

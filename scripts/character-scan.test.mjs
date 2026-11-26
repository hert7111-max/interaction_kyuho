import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG } from '../src/config.js'
import { createScanMachine, PHASE } from '../src/character-scan/state-machine.js'
import { createScanAccumulator, sampleScanFrame } from '../src/character-scan/scan-data.js'

test('Scan waits for its full configured window and stores only a completed result', () => {
  const scan = createScanMachine()
  scan.start(100)
  const result = { proportions: { torsoLength: 1 } }
  assert.equal(scan.progress(100), 0)
  assert.equal(scan.progress(100 + CONFIG.scan.durationMs / 2), .5)
  assert.equal(scan.finish(100 + CONFIG.scan.durationMs - 1, result), false)
  assert.equal(scan.finish(100 + CONFIG.scan.durationMs, null), false)
  assert.equal(scan.finish(100 + CONFIG.scan.durationMs, result), true)
  assert.equal(scan.phase, PHASE.BUILDING)
  assert.equal(scan.scanResult, result)
  scan.reset()
  assert.equal(scan.phase, PHASE.IDLE)
  assert.equal(scan.scanResult, null)
})

test('Upper-body ratios account for frame aspect and average visible color samples', () => {
  const width = 200, height = 400
  const landmarks = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }))
  for (const [index, x, y] of [
    [0, .5, .20], [2, .46, .1875], [5, .54, .1875], [7, .42, .20], [8, .58, .20],
    [11, .35, .30], [12, .65, .30], [23, .375, .55], [24, .625, .55],
    [25, .35, .725], [26, .65, .725], [27, .35, .90], [28, .65, .90],
  ]) Object.assign(landmarks[index], { x, y })
  const frame = { width, height, data: new Uint8ClampedArray(width * height * 4) }
  const mask = { width, height, pixels: new Uint8Array(width * height).fill(255) }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgb = y < 64 ? [31, 25, 20] : y < 110 ? [198, 142, 103] : y < 226 ? [34, 130, 84] : [61, 77, 146]
    frame.data.set([...rgb, 255], (y * width + x) * 4)
  }
  const sample = sampleScanFrame(landmarks, frame, mask)
  const scan = createScanAccumulator(() => 0)
  assert.equal(scan.finish(), null)
  for (let i = 0; i < CONFIG.scan.minimumSamples; i++) scan.add(sample)
  scan.add({ colors: { skin: [210, 142, 103] } })
  const result = scan.finish()
  assert.ok(Math.abs(result.proportions.shoulderWidth - 60 / (32 * CONFIG.scan.clothesPatch.headToTorso)) < 1e-9)
  assert.equal(result.proportions.torsoLength, 1)
  assert.equal(result.proportions.legLength, CONFIG.character.geometry.legReference)
  assert.deepEqual(result.colors, {
    skin: { r: 200, g: 142, b: 103 }, hair: { r: 31, g: 25, b: 20 },
    top: { r: 34, g: 130, b: 84 }, bottom: { r: 99, g: 130, b: 166 },
  })
  assert.equal(result.samples.frames, CONFIG.scan.minimumSamples + 1)
  assert.equal(result.samples.top, CONFIG.scan.minimumSamples)
  mask.pixels.fill(0)
  assert.equal(sampleScanFrame(landmarks, frame, mask).colors.skin, null)
})

test('The subject build advances for two visible seconds, then enters CONTROL with the scan data', () => {
  const scan = createScanMachine()
  const result = { proportions: { torsoLength: 1 } }
  const endOfScan = 100 + CONFIG.scan.durationMs
  scan.start(100)
  scan.finish(endOfScan, result)
  scan.pauseBuild(endOfScan + 500)
  assert.equal(scan.buildProgress(endOfScan + 1500), .25)
  assert.equal(scan.completeBuild(endOfScan + 3000), false)
  scan.resumeBuild(endOfScan + 1500)
  assert.equal(scan.completeBuild(endOfScan + 2999), false)
  assert.equal(scan.completeBuild(endOfScan + 3000), true)
  assert.equal(scan.phase, PHASE.CONTROL)
  assert.equal(scan.scanResult, result)
})

test('The procedural body adapts proportions while keeping its two-head-tall silhouette', async () => {
  const { makeBody, subjectDimensions, triangleCount } = await import('../src/character-scan/character-model.js')
  const { Box3, MeshLambertMaterial, Vector3 } = await import('three')
  const short = { proportions: { shoulderWidth: .45, torsoLength: 1, legLength: 1.1 } }
  const tall = { proportions: { shoulderWidth: .95, torsoLength: 1, legLength: 1.8 } }
  const from = subjectDimensions(short), to = subjectDimensions(tall)
  assert.ok(to.chest > from.chest && to.legs > from.legs)
  assert.equal(from.torso, to.torso)
  const color = new MeshLambertMaterial()
  const materials = Object.fromEntries(['skin', 'face', 'hair', 'top', 'bottom', 'shoes'].map(name => [name, color]))
  const small = makeBody(short, materials)
  const large = makeBody(tall, materials)
  assert.ok(large.height > small.height)
  for (const { subject, height } of [small, large]) {
    const headBounds = new Box3().setFromObject(subject.getObjectByName('Head'))
    const noseBounds = new Box3().setFromObject(subject.getObjectByName('Nose'))
    const ratio = headBounds.getSize(new Vector3()).y / height
    assert.ok(ratio > .47 && ratio < .53)
    assert.ok(noseBounds.max.z > headBounds.max.z)
    assert.ok(triangleCount(subject) < CONFIG.character.maxTriangles)
  }
})

function appearanceFixture({ hair, top, bottom, band = false, footwear = 'shoes' }) {
  const width = 320, height = 400
  const frame = { width, height, data: new Uint8ClampedArray(width * height * 4) }
  const mask = { width, height, pixels: new Uint8Array(width * height) }
  const skin = [129, 83, 58], hairColor = [24, 20, 18], shirt = [27, 34, 45], pants = [56, 80, 128]
  const shoeColor = footwear === 'bare' ? skin : [83, 74, 69]
  const paint = (left, top, right, bottom, rgb) => {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const pixel = y * width + x
      frame.data.set([...rgb, 255], pixel * 4)
      mask.pixels[pixel] = 255
    }
  }
  const landmarks = Array.from({ length: 33 }, () => null)
  for (const [i, x, y] of [
    [0,160,83], [2,147,77], [5,173,77], [7,135,82], [8,185,82],
    [11,122,132], [12,198,132], [13,111,190], [14,209,190], [15,109,242], [16,211,242],
    [23,143,227], [24,177,227], [25,141,298], [26,179,298], [27,142,366], [28,178,366],
    [29,136,372], [30,174,372], [31,149,378], [32,187,378],
  ]) landmarks[i] = { x: x / width, y: y / height, visibility: 1 }

  paint(136, 47, 184, 101, skin)
  if (hair !== 'bare') paint(136, hair === 'full' ? 23 : 47, 184, 57, hairColor)
  if (hair === 'parted') paint(136, 48, 159, 69, hairColor)
  if (hair === 'long') {
    paint(124, 50, 139, 132, hairColor)
    paint(181, 50, 196, 132, hairColor)
  }
  paint(121, 122, 199, 232, shirt)
  if (band) paint(130, 161, 190, 191, [148, 182, 212])
  const sleeveEnd = { sleeveless: 134, short: 157, long: 239 }[top]
  const armSkin = top === 'sleeveless' ? [231, 145, 102] : skin
  for (const [left, right] of [[105, 126], [194, 215]]) {
    paint(left, 132, right, 245, armSkin)
    paint(left, 132, right, sleeveEnd, shirt)
  }
  for (const [left, right] of [[127, 156], [164, 194]]) {
    paint(left, 228, right, 371, skin)
    paint(left, 228, right, bottom === 'shorts' ? 309 : 371, pants)
    paint(left, 370, right, 388, shoeColor)
  }
  return { landmarks, frame, mask, skin, hairColor, shoeColor }
}

test('Masked scan distinguishes hair contours, sleeve lengths, and a two-tone shirt', () => {
  for (const look of [
    { hair: 'cropped', top: 'sleeveless', bottom: 'trousers' },
    { hair: 'parted', top: 'short', bottom: 'shorts', band: true },
    { hair: 'full', top: 'long', bottom: 'trousers' },
    { hair: 'long', top: 'short', bottom: 'shorts' },
    { hair: 'bare', top: 'sleeveless', bottom: 'trousers', footwear: 'bare' },
  ]) {
    const { landmarks, frame, mask, skin, hairColor } = appearanceFixture(look)
    const sample = sampleScanFrame(landmarks, frame, mask)
    assert.equal(sample.appearance.hair, look.hair)
    assert.equal(sample.appearance.top, look.top)
    assert.equal(sample.colors.bottom, undefined)
    assert.equal(sample.appearance.pattern, look.band ? 'band' : 'plain')
    assert.deepEqual(sample.colors.skin, skin)
    assert.deepEqual(sample.colors.hair, look.hair === 'bare' ? null : hairColor)
    assert.equal(sample.appearance.footwear, undefined)
    const scan = createScanAccumulator()
    for (let i = 0; i < CONFIG.scan.minimumSamples; i++) scan.add(sample)
    scan.add({ ...sample, appearance: { hair: 'full', top: 'long', pattern: 'plain' } })
    const result = scan.finish()
    assert.equal(result.appearance.hair, look.hair)
    assert.equal(result.appearance.top, look.top)
    if (look.band) assert.deepEqual(result.appearance.topAccent, { r: 148, g: 182, b: 212 })
  }
})

test('Chest-up scans generate a stable outfit without reading hips, legs, or feet', () => {
  const { landmarks, frame, mask } = appearanceFixture({ hair: 'parted', top: 'short', bottom: 'trousers', band: true })
  const height = 223
  const upper = landmarks.slice(0, CONFIG.scan.upperLandmarkCount).map(point =>
    point && { ...point, y: point.y * frame.height / height })
  const cropped = sampleScanFrame(upper, { ...frame, height, data: frame.data.subarray(0, frame.width * height * 4) },
    { ...mask, height, pixels: mask.pixels.subarray(0, mask.width * height) })
  let selections = 0
  const scan = createScanAccumulator(() => selections++ * .5)
  const full = createScanAccumulator(() => 0)
  const fullSample = sampleScanFrame(landmarks, frame, mask)
  for (let i = 0; i < CONFIG.scan.minimumSamples; i++) {
    scan.add(cropped)
    full.add(fullSample)
  }
  const result = scan.finish()
  assert.equal(result.appearance.hair, 'parted')
  assert.equal(result.appearance.top, 'short')
  assert.equal(result.appearance.pattern, 'band')
  assert.deepEqual(result.colors.bottom, full.finish().colors.bottom)
  assert.deepEqual(result.appearance.shoeColor, full.finish().appearance.shoeColor)
  assert.deepEqual(scan.finish(), result)
  assert.equal(selections, 1)

  const variant = createScanAccumulator(() => .5)
  for (let i = 0; i < CONFIG.scan.minimumSamples; i++) variant.add(cropped)
  assert.equal(variant.finish().appearance.bottom, 'shorts')
  assert.notDeepEqual(variant.finish().appearance.shoeColor, result.appearance.shoeColor)
})

test('Generated hairstyles and garments vary the rig and fit the scene triangle budget', async () => {
  const { makeBody, triangleCount } = await import('../src/character-scan/character-model.js')
  const { MeshLambertMaterial } = await import('three')
  const materials = Object.fromEntries(['skin', 'face', 'hair', 'top', 'sleeves', 'bottom', 'shoes']
    .map(name => [name, new MeshLambertMaterial()]))
  const proportions = { shoulderWidth: .76, torsoLength: 1, legLength: 1.55 }
  const cropped = makeBody({ proportions, appearance: { hair: 'cropped', top: 'long' } }, materials)
  const styled = makeBody({ proportions, appearance: { hair: 'long', top: 'short', bottom: 'shorts' } }, materials)
  const croppedArm = cropped.joints.arms[0].getObjectByName('Upper arm')
  const styledArm = styled.joints.arms[0].getObjectByName('Upper arm')
  assert.deepEqual(croppedArm.geometry.groups.map(group => group.materialIndex), [1])
  assert.deepEqual(styledArm.geometry.groups.map(group => group.materialIndex), [0, 1])
  assert.ok(styled.subject.getObjectByName('Hair length'))
  assert.ok(styled.joints.knees[0].getObjectByName('Shin and shorts hem'))
  const ground = CONFIG.character.ground
  const roadTriangles = 12 * (3 + ground.paintPositions.length + ground.roadside.posts.length * 2) + ground.shadowSegments
  assert.ok(triangleCount(styled.subject) + roadTriangles <= CONFIG.character.maxTriangles)
  assert.ok(triangleCount(styled.subject) > triangleCount(cropped.subject))
})

import * as THREE from 'three'
import { CONFIG } from '../config.js'

export { makeSubjectMaterials } from './character-materials.js'

const shape = CONFIG.character.geometry
const defaults = CONFIG.scan.appearance.defaults
const bound = (value, [low, high]) => Math.min(high, Math.max(low, value))

export function subjectDimensions({ proportions }) {
  const torso = shape.torsoBase + (bound(proportions.torsoLength, shape.torso) - 1) * shape.torsoGain
  const legs = shape.legBase + (bound(proportions.legLength, shape.legs) - shape.legReference) * shape.legGain
  return {
    chest: shape.chestBase + bound(proportions.shoulderWidth, shape.shoulder) * shape.shoulderGain,
    torso, legs,
    head: (torso + legs + shape.neckHeight) * shape.headRatio,
  }
}

// Horizontal cross-sections taper the silhouette while UVs wrap around each rigid part.
function loft(parent, name, sides, sections, material, options = {}) {
  const positions = [], uvs = [], indices = []
  const geometry = new THREE.BufferGeometry()
  const low = sections[0][0], high = sections.at(-1)[0]
  for (const [row, [height, width, depth, z = 0, x = 0]] of sections.entries()) {
    for (let col = 0; col <= sides; col++) {
      const u = col / sides
      const angle = (u - .5) * Math.PI * 2
      const around = Math.sin(angle), forward = Math.cos(angle)
      const y = options.adjust ? options.adjust(row, height, around, forward) : height
      positions.push(x + width * around / 2, y, z + depth * forward / 2)
      uvs.push(u, (height - low) / (high - low))
    }
  }
  const group = (materialIndex, append) => {
    const start = indices.length
    append()
    if (!Array.isArray(material)) return
    const previous = geometry.groups.at(-1)
    if (previous?.materialIndex === materialIndex) previous.count += indices.length - start
    else geometry.addGroup(start, indices.length - start, materialIndex)
  }
  const stride = sides + 1
  for (let row = 0; row < sections.length - 1; row++) {
    group(options.bands?.[row] ?? 0, () => {
      for (let col = 0; col < sides; col++) {
        const a = row * stride + col, b = a + stride
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    })
  }
  if (options.bottom) group(0, () => {
    for (let col = 1; col < sides - 1; col++) indices.push(0, col + 1, col)
  })
  if (options.top) group(options.bands?.at(-1) ?? 0, () => {
    const row = (sections.length - 1) * stride
    for (let col = 1; col < sides - 1; col++) indices.push(row, row + col, row + col + 1)
  })
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  parent.add(mesh)
  return mesh
}

function makeHead(subject, base, h, look, materials) {
  const { neckHeight, earPosition, earScale, nosePosition, noseScale } = shape
  const w = h * shape.headWidth, d = h * shape.headDepth
  loft(subject, 'Neck', 6, [
    [base - neckHeight - .048, shape.neckWidth * 1.05, .228, -.013],
    [base + .072, shape.neckWidth * .89, .192, .014],
  ], materials.skin)
  loft(subject, 'Head', 8, shape.headRings.map(([t, width, depth, z]) => [base + h * t, w * width, d * depth, z]),
    materials.face, { bottom: true, top: true })
  const nose = new THREE.Mesh(new THREE.OctahedronGeometry(1), materials.nose ?? materials.skin)
  nose.name = 'Nose'
  nose.position.set(0, base + h * nosePosition[0], d * nosePosition[1] / 2 + .015)
  nose.scale.set(...noseScale)
  subject.add(nose)
  const earGeometry = new THREE.SphereGeometry(1, 4, 3)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, materials.skin)
    ear.name = 'Ear'
    ear.position.set(side * w * earPosition[0], base + h * earPosition[1], earPosition[2])
    ear.scale.set(...earScale)
    ear.rotation.z = side * -.22
    subject.add(ear)
  }
  const style = shape.hair[look.hair]
  if (!style) return base + h

  const part = -(look.part || 1) // Match the mirrored camera preview.
  const swept = look.hair === 'parted'
  const shift = swept ? shape.hair.partShift * part : 0
  const crown = base + h + style.raise
  loft(subject, 'Hair', 8, [
    [base + h * style.fringe, w * style.width, d * style.depth, -.013],
    [base + h * .91 + style.raise * .37, w * style.width * .83, d * style.depth * .82, -.026, shift * .53],
    [crown, w * style.width * .39, d * style.depth * .49, -.042, shift],
  ], materials.hair, {
    top: true,
    adjust(row, height, around, forward) {
      if (row !== 0) return height
      const front = Math.max(0, forward)
      const longBack = look.hair === 'long' ? Math.max(0, -forward) * .20 : 0
      const nape = h * (shape.hair.backDrop * (1 - front) + longBack)
      return height - nape - (swept ? shift * around * front * 1.5 : 0)
    },
  })
  if (look.hair === 'long') {
    for (const side of [-1, 1]) {
      loft(subject, 'Hair length', 4, [
        [base - h * (side === part ? .17 : .12), w * .18, d * .27, -.149, side * w * .51],
        [base + h * .14, w * shape.hair.sideWidth, d * shape.hair.sideDepth, -.112, side * w * .45],
        [base + h * .57, w * .26, d * .52, -.096, side * w * .43],
      ], materials.hair, { bottom: true })
    }
  }
  return crown
}

function makeArm(subject, side, chest, torso, legs, clothing, materials) {
  const arm = new THREE.Group()
  arm.position.set(side * (chest / 2 - shape.shoulderInset), legs + torso * .887, 0)
  arm.rotation.set(-shape.armLean, 0, side * shape.armTilt)
  subject.add(arm)
  const upper = shape.armLength * torso, lower = shape.wristLength * torso
  const w = shape.armWidth * Math.sqrt(torso), d = shape.armDepth * Math.sqrt(torso)
  const sleeve = materials.sleeves ?? materials.top
  const upperBands = clothing === 'long' ? [1, 1] : clothing === 'short' ? [0, 1] : [0, 0]
  const sleeveScale = clothing === 'sleeveless' ? 1 : shape.sleeveWidth
  loft(arm, 'Upper arm', 6, [
    [-upper - .056, w * .66, d * .70, -.018],
    [-upper * .48, w * .845 * sleeveScale, d * .90 * sleeveScale, -.007, side * shape.armOut],
    [.077, w * .89 * sleeveScale, d * .95, 0, side * .01],
  ], [materials.skin, sleeve], { bands: upperBands, top: true })

  const elbow = new THREE.Group()
  elbow.position.set(0, -upper, -.014)
  arm.add(elbow)
  loft(elbow, 'Forearm and hand', 5, [
    [-lower - shape.mittenLength, w * .53, d * .55, .025],
    [-lower - shape.mittenLength * .52, w * 1.07, d * .92, .025],
    [-lower + .009, w * .75, d * .65, .004],
    [-lower * .28, w * .78, d * .79, -.005],
    [.091, w * .79, d * .80, .002],
  ], [materials.skin, sleeve], { bands: clothing === 'long' ? [0, 0, 1, 1] : [0, 0, 0, 0], bottom: true })
  return { arm, elbow }
}

function makeLeg(subject, side, hipWidth, legs, look, materials) {
  const leg = new THREE.Group()
  const w = Math.max(shape.legWidth, (hipWidth - shape.legGap) / 2), d = shape.legDepth
  leg.position.set(side * (hipWidth + shape.legGap) / 4, legs, .014)
  subject.add(leg)
  const shin = (legs - shape.shoeHeight) * shape.kneeHeight + shape.shoeHeight
  const thigh = legs - shin
  loft(leg, 'Thigh', 6, [
    [-thigh - .073, w * .83, d * .76, .023],
    [-thigh * .48, w * .99, d * .94, .005],
    [-.051, w * 1.07, d, -.003],
  ], materials.bottom)

  const knee = new THREE.Group()
  knee.position.set(0, -thigh, .033)
  leg.add(knee)
  const shorts = look.bottom === 'shorts'
  loft(knee, shorts ? 'Shin and shorts hem' : 'Trouser leg', 6, [
    [-shin + shape.shoeHeight * .70, w * (shorts ? .51 : .79), d * (shorts ? .50 : .79), -.025],
    [-.070, w * .79, d * .76, 0],
    [.069, w * .82, d * .77, -.017],
  ], [materials.bottom, materials.skin], { bands: shorts ? [1, 0] : [0, 0] })
  const barefoot = look.footwear === 'bare'
  const shoeWidth = Math.max(shape.legWidth * .91, w * .83) * (barefoot ? .76 : 1)
  const footDepth = shape.shoeDepth * (barefoot ? .81 : 1)
  loft(knee, barefoot ? 'Foot' : 'Sneaker', 6, [
    [-shin, shoeWidth, footDepth, shape.shoeToe],
    [-shin + shape.shoeHeight * .30, shoeWidth * 1.04, footDepth * 1.015, shape.shoeToe],
    [-shin + shape.shoeHeight * (barefoot ? .85 : 1), shoeWidth * .79, footDepth * .61, .023],
  ], barefoot ? materials.skin : materials.shoes, { top: true, bottom: true })
  return { leg, knee }
}

export function makeBody(scanResult, materials) {
  const subject = new THREE.Group()
  const joints = { arms: [], elbows: [], legs: [], knees: [] }
  const look = { ...defaults, ...scanResult.appearance }
  const { chest, torso, legs, head } = subjectDimensions(scanResult)
  const hip = chest * shape.hipWidth

  loft(subject, 'Shirt', 8, shape.torsoRings.map(([t, width, depth, z]) =>
    [legs + torso * t, chest * width, shape.torsoDepth * depth, z]), materials.top, { top: true })
  loft(subject, 'Waist', 6, [
    [legs - .142, hip * .99, shape.torsoDepth * .77, -.019],
    [legs - .012, hip, shape.torsoDepth * .79, -.017],
  ], materials.bottom)
  const height = makeHead(subject, legs + torso + shape.neckHeight, head, look, materials)

  for (const side of [-1, 1]) {
    const { arm, elbow } = makeArm(subject, side, chest, torso, legs, look.top, materials)
    const { leg, knee } = makeLeg(subject, side, hip, legs, look, materials)
    joints.arms.push(arm)
    joints.elbows.push(elbow)
    joints.legs.push(leg)
    joints.knees.push(knee)
  }
  return { subject, height, joints }
}

export function triangleCount(root) {
  let total = 0
  root.traverse(object => {
    if (!object.isMesh) return
    total += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
  })
  return total
}

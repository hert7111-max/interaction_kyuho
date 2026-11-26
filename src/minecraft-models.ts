import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Weapon } from './minecraft-combat'

function slab(parent: THREE.Group, points: readonly (readonly [number, number])[], depth: number, color: number, edge = color, z = 0) {
  const shape = new THREE.Shape()
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 })
  geometry.translate(0, 0, z - depth / 2)
  const material = (tint: number) => new THREE.MeshStandardMaterial({ color: tint, roughness: .8, flatShading: true })
  parent.add(new THREE.Mesh(geometry, [material(color), material(edge)]))
}

function block(parent: THREE.Group, size: [number, number, number], at: [number, number, number], color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .9 }))
  mesh.position.set(...at)
  parent.add(mesh)
  return mesh
}

/** Bake static parts into two batches while preserving face colors and roughness. */
function batch(group: THREE.Group) {
  const byRoughness = new Map<number, THREE.BufferGeometry[]>()
  for (const child of [...group.children] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>[]) {
    child.updateMatrix()
    const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry
    const materials = [child.material].flat()
    source.applyMatrix4(child.matrix)
    const ranges = materials.length === 1
      ? [{ start: 0, count: source.getAttribute('position').count, materialIndex: 0 }]
      : source.groups
    for (const { start, count, materialIndex } of ranges) {
      const material = materials[materialIndex ?? 0]!
      const geometry = new THREE.BufferGeometry()
      for (const key of ['position', 'normal'] as const) {
        const array = source.getAttribute(key).array as Float32Array
        geometry.setAttribute(key, new THREE.BufferAttribute(array.slice(start * 3, (start + count) * 3), 3))
      }
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) material.color.toArray(colors, i * 3)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const bucket = byRoughness.get(material.roughness) ?? []
      bucket.push(geometry)
      byRoughness.set(material.roughness, bucket)
    }
    group.remove(child)
    source.dispose()
    if (source !== child.geometry) child.geometry.dispose()
    for (const material of materials) material.dispose()
  }
  for (const [roughness, geometries] of byRoughness) {
    group.add(new THREE.Mesh(mergeGeometries(geometries), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness,
    })))
    for (const geometry of geometries) geometry.dispose()
  }
  return group
}

function grip(group: THREE.Group, length: number) {
  block(group, [.17, length, .18], [0, -.12, 0], 0x50352e)
  for (let i = 0; i < 5; i++) {
    block(group, [.185, .043, .194], [0, -.12 + (i - 2) * length / 5, 0], i % 2 ? 0x7c4d36 : 0x9d6745)
  }
}

function sword(group: THREE.Group) {
  grip(group, .58)
  block(group, [.29, .16, .24], [0, -.46, 0], 0x925c34)
  slab(group, [[-.19,.25],[-.19,1.5],[-.11,1.5],[-.11,1.63],[.19,1.9],[.19,.25]], .19, 0x297773, 0x143e46)
  const facet = [[-.135,.3],[-.135,1.47],[-.065,1.47],[-.065,1.6],[.139,1.78],[.139,.3]] as const
  const ridge = [[-.095,.35],[-.095,1.45],[-.016,1.45],[-.016,1.56],[.085,1.66],[.045,.35]] as const
  for (const face of [-1, 1]) {
    slab(group, facet, .012, 0x4dd3bc, 0x287c78, face * .099)
    slab(group, ridge, .01, 0xb9f4cd, 0x68c8a7, face * .108)
    block(group, [.059,.13,.012], [-.077,1.31,face * .115], 0xd9f9d7)
    block(group, [.051,.09,.014], [-.045,1.20,face * .115], 0xd9f9d7)
    block(group, [.05,.19,.015], [.093,.72,face * .111], 0x60dbc7)
    block(group, [.045,.09,.015], [.121,.61,face * .111], 0x60dbc7)
  }
  slab(group, [[-.47,.18],[-.47,.33],[-.31,.33],[-.31,.28],[.31,.28],[.31,.33],[.47,.33],[.47,.18],[.16,.09],[-.16,.09]], .29, 0xd3a45e, 0x744738)
  block(group, [.15,.14,.31], [0,.22,0], 0x6b4666)
}

function bow(group: THREE.Group) {
  const limb = [[-.13,.1],[-.16,.46],[-.28,.73],[-.47,.92],[-.56,1.03],[-.56,1.14],[-.39,1.14],[-.39,1.04],[-.13,.88],[.035,.57],[.075,.1]] as const
  for (const sign of [-1, 1]) {
    slab(group, limb.map(([x,y]) => [x,y * sign]), .14, 0xb78654, 0x644232)
    block(group, [.13,.13,.19], [-.48,1.06 * sign,0], 0xf1db9d)
    block(group, [.16,.085,.17], [-.18,.72 * sign,0], 0x457a73).rotation.z = sign * .47
  }
  grip(group, .42)
}

function hammer(group: THREE.Group) {
  grip(group, .68)
  block(group, [.15,1.22,.16], [0,.38,0], 0x72503f)
  block(group, [.26,.16,.24], [0,.81,0], 0xb08160)
  slab(group, [[-.54,.88],[-.54,1.38],[-.38,1.53],[.39,1.53],[.56,1.36],[.56,.91],[.42,.76],[-.4,.76]], .51, 0x656578, 0x333749)
  for (const side of [-1, 1]) {
    block(group, [.17,.56,.58], [side * .46,1.14,0], 0xa8a2ae)
    block(group, [.17,.17,.025], [0,1.15,side * .266], 0xe4b567).rotation.z = Math.PI / 4
  }
  block(group, [.25,.13,.26], [0,-.47,0], 0x817789)
}

export function makeWeapon(id: Weapon['id']) {
  const group = new THREE.Group()
  if (id === 'sword') sword(group)
  if (id === 'bow') bow(group)
  if (id === 'hammer') hammer(group)
  return batch(group)
}

export function makeHand() {
  const hand = new THREE.Group()
  const sleeve = block(hand, [.4,.79,.37], [.17,-.62,.13], 0x38445f)
  sleeve.rotation.z = .32
  block(hand, [.42,.19,.415], [.085,-.34,.135], 0x987962).rotation.z = .32
  block(hand, [.29,.31,.29], [.046,-.19,.087], 0xad775a)
  block(hand, [.12,.22,.135], [-.12,-.12,.098], 0xc09171)
  return batch(hand)
}

export function makeBowString() {
  const group = new THREE.Group()
  const strands = [-1, 1].map(() => block(group, [.018,1,.018], [0,0,0], 0xf1ddac))
  const nock = new THREE.Vector3()
  const tip = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let previous = -1
  return {
    group,
    draw(amount: number) {
      if (amount === previous) return
      previous = amount
      nock.set(-.5 - amount * .48, 0, .025)
      strands.forEach((strand, index) => {
        tip.set(-.49, index ? 1.06 : -1.06, .025)
        strand.position.copy(nock).lerp(tip, .5)
        strand.scale.y = tip.distanceTo(nock)
        strand.quaternion.setFromUnitVectors(up, tip.sub(nock).normalize())
      })
    },
  }
}

export function makeArrow() {
  const arrow = new THREE.Group()
  block(arrow, [.04,.68,.04], [0,.05,0], 0xb38a5a)
  slab(arrow, [[-.075,.31],[.075,.31],[0,.51]], .075, 0xd2e2dc)
  block(arrow, [.13,.14,.035], [0,-.27,0], 0xdcad62)
  return batch(arrow)
}

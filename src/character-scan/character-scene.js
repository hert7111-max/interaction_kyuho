import * as THREE from 'three'
import { CONFIG } from '../config.js'
import { GESTURE } from '../gesture.js'
import { CharacterMotion } from './character-motion.js'
import { makeBody, makeSubjectMaterials, triangleCount } from './character-model.js'

const settings = CONFIG.character
const { ground, light, camera: view, reveal } = settings
const { hud } = CONFIG.colors
const motion = CONFIG.motion

function makeRoadTexture() {
  const canvas = document.createElement('canvas')
  const size = settings.textureSize
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  context.fillStyle = ground.road
  context.fillRect(0, 0, size, size)
  for (const [tone, color] of ground.asphaltSpeckle.entries()) {
    context.fillStyle = color
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (((x * 23) ^ (y * 17) ^ (x * y)) % ground.specklePeriod === tone) context.fillRect(x, y, 1, 1)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.repeat.set(...ground.textureRepeats)
  return texture
}

function makeRoad() {
  const root = new THREE.Group()
  const texture = makeRoadTexture()
  const asphalt = new THREE.MeshLambertMaterial({ map: texture, flatShading: true })
  const road = new THREE.MeshLambertMaterial({ color: ground.road, flatShading: true })
  const edge = new THREE.MeshLambertMaterial({ color: ground.edge, flatShading: true })
  const paint = new THREE.MeshLambertMaterial({ color: ground.paint, flatShading: true })
  const roadside = ground.roadside
  const post = new THREE.MeshLambertMaterial({ color: roadside.color, flatShading: true })
  const cap = new THREE.MeshLambertMaterial({ color: roadside.cap, flatShading: true })
  const postGeometry = new THREE.BoxGeometry(...roadside.size)
  const capGeometry = new THREE.BoxGeometry(...roadside.capSize)

  const add = (width, height, depth, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    root.add(mesh)
    return mesh
  }
  add(ground.width, ground.thickness, ground.length, [road, road, asphalt, road, road, road], 0, -ground.thickness / 2, 0)
  for (const side of [-1, 1]) {
    add(ground.edging, ground.edging, ground.length, edge,
      side * (ground.width - ground.edging) / 2, 0, 0)
  }
  const markings = ground.paintPositions.map(z =>
    add(ground.paintWidth, ground.shadowHeight, ground.paintLength, paint,
      -ground.width / 4, ground.shadowHeight / 2, z))
  const posts = roadside.posts.map(([side, z]) => {
    const group = new THREE.Group()
    const base = new THREE.Mesh(postGeometry, post)
    const top = new THREE.Mesh(capGeometry, cap)
    base.position.y = roadside.size[1] / 2
    top.position.y = roadside.size[1] + roadside.capSize[1] / 2
    group.add(base, top)
    group.position.set(side * roadside.lateral, 0, z)
    root.add(group)
    return group
  })
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(ground.shadowRadius, ground.shadowSegments),
    new THREE.MeshBasicMaterial({ color: ground.shadow, opacity: ground.shadowOpacity, transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = ground.shadowHeight
  shadow.scale.y = ground.shadowAspect
  root.add(shadow)
  return { root, texture, posts, markings, shadow }
}

function configureSnap(material) {
  if (!settings.vertexSnap) return
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec2 grid = vec2(${settings.snapGrid.toFixed(1)});
      vec2 point = gl_Position.xy / gl_Position.w;
      gl_Position.xy = floor(point * grid + .5) / grid * gl_Position.w;
    `)
  }
}

export class CharacterScene {
  constructor(canvas, scanResult, menu) {
    this.canvas = canvas
    this.menu = menu
    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, powerPreference: 'low-power',
    })
    this.renderer.localClippingEnabled = true
    this.renderer.setClearColor(0, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, view.near, view.far)
    this.progress = 0

    const solidPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
    const wirePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.solidPlane = solidPlane
    this.wirePlane = wirePlane
    this.subjectMaterials = makeSubjectMaterials(scanResult.colors, solidPlane, scanResult.appearance)
    for (const material of Object.values(this.subjectMaterials)) configureSnap(material)
    const { subject, height, joints } = makeBody(scanResult, this.subjectMaterials)
    this.joints = joints
    this.motion = new CharacterMotion()
    this.height = height
    this.subject = subject
    this.head = new THREE.Vector3()
    this.lastControlDraw = -Infinity
    this.lastControlState = null
    this.lastControlDistance = 0
    this.wires = new THREE.Group()
    this.wireMaterial = new THREE.LineBasicMaterial({
      color: hud, clippingPlanes: [wirePlane], transparent: true, opacity: reveal.wireOpacity,
    })
    configureSnap(this.wireMaterial)
    // Copy each mesh's world transform, including its arm joint rotation.
    subject.updateMatrixWorld(true)
    subject.traverse(part => {
      if (!part.isMesh) return
      const line = new THREE.LineSegments(new THREE.WireframeGeometry(part.geometry), this.wireMaterial)
      line.applyMatrix4(part.matrixWorld)
      this.wires.add(line)
    })

    const { root: road, texture, posts, markings, shadow } = makeRoad()
    this.road = road
    this.roadTexture = texture
    this.posts = posts
    this.markings = markings
    this.shadow = shadow
    this.triangles = triangleCount(subject) + triangleCount(this.road)
    if (this.triangles > settings.maxTriangles) throw new Error('Character exceeds the triangle budget.')
    this.canvas.dataset.triangles = String(this.triangles)

    const beam = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-reveal.sweepWidth, 0, -reveal.sweepDepth),
      new THREE.Vector3(reveal.sweepWidth, 0, -reveal.sweepDepth),
      new THREE.Vector3(reveal.sweepWidth, 0, reveal.sweepDepth),
      new THREE.Vector3(-reveal.sweepWidth, 0, reveal.sweepDepth),
    ])
    this.sweep = new THREE.LineLoop(beam, new THREE.LineBasicMaterial({
      color: hud, transparent: true, opacity: reveal.beamOpacity, depthTest: false, depthWrite: false,
    }))
    this.focus = height * view.targetY + motion.jumpHeight * view.jumpFocus
    this.camera.position.set(view.position[0], this.focus + view.position[1], view.position[2])
    this.camera.lookAt(0, this.focus, 0)
    this.camera.updateMatrixWorld(true)

    const key = new THREE.DirectionalLight(hud, light.key)
    key.position.set(...light.keyPosition)
    const fill = new THREE.DirectionalLight(hud, light.fill)
    fill.position.set(...light.fillPosition)
    this.scene.add(new THREE.AmbientLight(hud, light.ambient), key, fill, this.road, subject, this.wires, this.sweep)
    this.resize()
  }

  resize() {
    this.viewport = this.canvas.getBoundingClientRect()
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight)
    const aspect = w / h
    const menuBottom = this.menu?.getBoundingClientRect().bottom ?? 0
    const reservedTop = Math.max(0, menuBottom - this.viewport.top) + view.hudClearance
    const visible = Math.max(view.minimumVisible, 1 - reservedTop / h)
    const jumpRoom = this.height + motion.jumpHeight - this.focus + view.headroom
    const verticalRoom = Math.max(jumpRoom, this.focus + view.groundRoom)
    const frustum = Math.max(view.minHeight, view.minWidth / aspect, verticalRoom * 2 / visible)
    const shift = frustum * (1 - visible) / 2
    this.camera.left = -frustum * aspect / 2
    this.camera.right = frustum * aspect / 2
    this.camera.top = shift + frustum / 2
    this.camera.bottom = shift - frustum / 2
    this.camera.updateProjectionMatrix()
    const height = Math.min(h, settings.renderHeight)
    this.renderer.setSize(Math.max(1, Math.round(height * aspect)), height, false)
    this.lastControlDraw = -Infinity
    this.render(this.progress)
  }

  destinations() {
    const rect = this.viewport
    return CONFIG.build.transfer.targetLevels.map(level => {
      const point = new THREE.Vector3(0, this.height * level, 0).project(this.camera)
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 }
    })
  }

  render(progress) {
    this.progress = progress
    const filled = Math.max(0, (progress - CONFIG.build.wireIntro) / (1 - CONFIG.build.wireIntro))
    const y = filled * this.height
    this.solidPlane.constant = progress >= 1 ? this.height + motion.jumpHeight + reveal.sweepInset : y - reveal.sweepInset
    this.wirePlane.constant = -y
    this.wires.visible = progress < 1
    this.sweep.visible = filled > 0 && filled < 1
    this.sweep.position.y = y
    this.renderer.render(this.scene, this.camera)
  }

  control(now, input) {
    const pose = this.motion.update(now, input)
    const travelling = pose.distance !== this.lastControlDistance
    const elapsed = now - this.lastControlDraw
    if (!travelling && !pose.handMoving && pose.state === this.lastControlState && pose.state !== GESTURE.JUMP &&
        (elapsed < 1000 / motion.idleRenderFps || (pose.state === GESTURE.STOP && Number.isFinite(elapsed)))) return
    this.lastControlDraw = now
    this.lastControlState = pose.state
    this.subject.position.set(pose.side, pose.height, 0)
    this.subject.rotation.set(pose.lean, pose.turn, pose.tilt)
    this.subject.scale.set(pose.scaleXZ, pose.scaleY, pose.scaleXZ)
    const { armLean, armTilt, elbows, knees } = settings.geometry
    for (let i = 0; i < this.joints.arms.length; i++) {
      const side = i === 0 ? -1 : 1
      this.joints.arms[i].rotation.x = -armLean + side * pose.arm - pose.jumpArm - pose.handLift
      this.joints.arms[i].rotation.z = side * (armTilt + pose.handSpread)
      this.joints.elbows[i].rotation.x = -Math.max(0, -side * pose.arm) * elbows.swing - pose.jumpArm * elbows.jump
      this.joints.legs[i].rotation.x = -side * pose.leg - pose.jumpKnee
      this.joints.knees[i].rotation.x = Math.max(0, -side * pose.leg) * knees.swing + pose.jumpKnee * knees.jump
    }
    this.shadow.scale.set(pose.shadowScale, ground.shadowAspect * pose.shadowScale, 1)
    this.shadow.position.x = pose.side
    if (travelling) {
      this.lastControlDistance = pose.distance
      this.roadTexture.offset.y = (-pose.distance * this.roadTexture.repeat.y / ground.length) % 1
      const wrap = (origin, span) => THREE.MathUtils.euclideanModulo(origin - pose.distance + span / 2, span) - span / 2
      this.markings.forEach((mark, i) => {
        mark.position.z = wrap(ground.paintPositions[i], ground.length - ground.paintLength)
      })
      const postSpan = ground.length - ground.roadside.capSize[2]
      this.posts.forEach((post, i) => {
        post.position.z = wrap(ground.roadside.posts[i][1], postSpan)
        post.scale.y = THREE.MathUtils.smoothstep(postSpan / 2 - Math.abs(post.position.z), 0, ground.roadside.fadeDistance)
      })
    }
    this.renderer.render(this.scene, this.camera)
    const { left, top, width, height } = this.viewport
    this.subject.localToWorld(this.head.set(0, this.height, 0)).project(this.camera)
    return { state: pose.state, x: left + (this.head.x + 1) * width / 2, y: top + (1 - this.head.y) * height / 2 }
  }

  dispose() {
    const materials = new Set(Object.values(this.subjectMaterials))
    const geometries = new Set()
    this.scene.traverse(item => {
      if (item.geometry) geometries.add(item.geometry)
      if (item.material) for (const material of [item.material].flat()) materials.add(material)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) {
      material.map?.dispose()
      material.dispose()
    }
    delete this.canvas.dataset.triangles
    this.renderer.clear()
    this.renderer.dispose()
  }
}

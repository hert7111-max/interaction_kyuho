import * as THREE from 'three'
import { coverScale } from './water-math'
import { equipment, maskThreshold } from './minecraft-combat'
import type { PersonMask, Strike, Weapon } from './minecraft-combat'
import { PersonBurst } from './minecraft-burst'
import { makeArrow, makeBowString, makeHand, makeWeapon } from './minecraft-models'

const videoVertex = `
varying vec2 screenUV;
void main() {
  screenUV = uv;
  gl_Position = vec4(position.xy, 0., 1.);
}`

const videoFragment = `
varying vec2 screenUV;
uniform sampler2D cameraFrame, personMask, backgroundPlate;
uniform vec2 cover;
uniform float flash, threshold, defeated;
void main() {
  vec2 picture = (screenUV - .5) * cover + .5;
  picture.x = 1. - picture.x;
  vec3 rgb = texture2D(cameraFrame, picture).rgb;
  vec2 maskUV = vec2(picture.x, 1. - picture.y);
  if (defeated > .5) {
    float confidence = texture2D(personMask, maskUV).r;
    float blend = smoothstep(.16, .56, confidence);
    vec3 replacement = texture2D(backgroundPlate, maskUV).rgb;
    gl_FragColor = vec4(mix(rgb, replacement, blend), 1.);
  } else if (flash > 0.) {
    float confidence = texture2D(personMask, maskUV).r;
    float silhouette = smoothstep(threshold, threshold + .18, confidence);
    vec3 red = vec3(.31 + dot(rgb, vec3(.30,.59,.11)) * .64, rgb.g * .11, rgb.b * .10);
    gl_FragColor = vec4(mix(rgb, red, flash * silhouette), 1.);
  } else {
    gl_FragColor = vec4(rgb, 1.);
  }
}`

const smooth = (t: number) => {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

function createMaskTexture(pixels: Uint8Array, width: number, height: number) {
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RedFormat)
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export class MineRenderer {
  readonly icons = new Map<Weapon['id'], string>()
  private gl: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 2.1, -2.1, .01, 25)
  private view = new THREE.Group()
  private hand = makeHand()
  private weapons = equipment.map(item => makeWeapon(item.id))
  private string = makeBowString()
  private arrow = makeArrow()
  private texture: THREE.VideoTexture
  private videoSize = new THREE.Vector2()
  private emptyMask = createMaskTexture(new Uint8Array(1), 1, 1)
  private mask: THREE.DataTexture | null = null
  private plateTexture: THREE.DataTexture | null = null
  private pendingMask: PersonMask | null = null
  private burst = new PersonBurst()
  private renderScale = 1
  private cutoutAt = Infinity
  private background: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private aspect = 1
  private video: HTMLVideoElement

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.video = video
    this.gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
    this.gl.setClearColor(0x000000, 0)
    this.camera.position.z = 8
    this.texture = new THREE.VideoTexture(video)
    this.background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: videoVertex,
      fragmentShader: videoFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        cameraFrame: { value: this.texture },
        personMask: { value: this.emptyMask },
        backgroundPlate: { value: this.emptyMask },
        defeated: { value: 0 },
        cover: { value: new THREE.Vector2(1, 1) },
        flash: { value: 0 },
        threshold: { value: maskThreshold },
      },
    }))
    this.background.renderOrder = -10
    this.background.frustumCulled = false
    this.background.visible = false
    this.scene.add(this.background, new THREE.HemisphereLight(0xfff2df, 0x6f7199, 2.15))
    const key = new THREE.DirectionalLight(0xc0fff3, 2.0)
    key.position.set(-3, 4, 5)
    this.scene.add(key, this.view, this.arrow, this.burst.mesh)
    this.weapons[1]!.add(this.string.group)
    this.string.draw(0)
    this.arrow.visible = false
    this.makeIcons()
    this.view.add(this.hand, ...this.weapons)
    this.resize()
  }

  private makeIcons() {
    this.gl.setSize(96, 96, false)
    this.camera.left = -1.39
    this.camera.right = 1.39
    this.camera.top = 1.39
    this.camera.bottom = -1.39
    this.camera.updateProjectionMatrix()
    for (const [index, weapon] of this.weapons.entries()) {
      this.view.add(weapon)
      weapon.rotation.set(.19, -.31, -.64)
      weapon.position.set(-.25, index === 1 ? 0 : -.38, 0)
      this.gl.render(this.scene, this.camera)
      this.icons.set(equipment[index]!.id, this.gl.domElement.toDataURL('image/png'))
      weapon.position.set(0, 0, 0)
      weapon.rotation.set(0, 0, 0)
      this.view.remove(weapon)
    }
    this.camera.top = 2.1
    this.camera.bottom = -2.1
  }

  resize() {
    const { clientWidth, clientHeight } = this.gl.domElement
    const width = Math.max(1, clientWidth), height = Math.max(1, clientHeight)
    this.aspect = width / height
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(2_400_000 / (width * height))) * this.renderScale)
    this.gl.setSize(width, height, false)
    this.camera.left = -2.1 * this.aspect
    this.camera.right = 2.1 * this.aspect
    this.camera.updateProjectionMatrix()
  }

  reduceResolution() {
    if (this.renderScale <= .72) return
    this.renderScale = Math.max(.72, this.renderScale - .12)
    this.resize()
  }

  setMask(mask: PersonMask) { this.pendingMask = mask }

  setBackground(data: Uint8ClampedArray, width: number, height: number) {
    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    if (!this.plateTexture || this.plateTexture.image.width !== width || this.plateTexture.image.height !== height) {
      this.plateTexture?.dispose()
      this.plateTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
      this.plateTexture.minFilter = this.plateTexture.magFilter = THREE.LinearFilter
      this.background.material.uniforms.backgroundPlate!.value = this.plateTexture
    } else {
      this.plateTexture.image.data = pixels
    }
    this.plateTexture.needsUpdate = true
  }

  defeat(mask: PersonMask, now: number) {
    this.setMask(mask)
    this.cutoutAt = now + 75
    const cover = coverScale(this.video.videoWidth / this.video.videoHeight, this.aspect)
    try { this.burst.start(this.video, mask, cover.x, cover.y, this.cutoutAt) }
    catch { /* Continue compositing the background if particle color readback fails. */ }
  }

  clearDefeat() {
    this.plateTexture?.dispose()
    this.plateTexture = null
    this.cutoutAt = Infinity
    this.background.material.uniforms.backgroundPlate!.value = this.emptyMask
    this.background.material.uniforms.defeated!.value = 0
    this.burst.clear()
  }

  burstActive(now: number) { return this.burst.active(now) }

  private uploadMask(mask: PersonMask) {
    if (!this.mask || this.mask.image.width !== mask.width || this.mask.image.height !== mask.height) {
      this.mask?.dispose()
      this.mask = createMaskTexture(mask.pixels, mask.width, mask.height)
    } else {
      this.mask.image.data = mask.pixels
      this.mask.needsUpdate = true
    }
    this.background.material.uniforms.personMask!.value = this.mask
  }

  render(now: number, weapon: Weapon, strike: Strike | null, flash: number) {
    this.burst.update(now, this.aspect)
    this.background.material.uniforms.defeated!.value = Number(this.plateTexture !== null && now >= this.cutoutAt)
    const visible = this.video.readyState >= 2 && !!this.video.srcObject
    this.background.visible = visible
    if (visible) {
      if (this.pendingMask && (flash > 0 || this.cutoutAt !== Infinity)) {
        this.uploadMask(this.pendingMask)
        this.pendingMask = null
      }
      const { videoWidth, videoHeight } = this.video
      if (this.videoSize.x !== videoWidth || this.videoSize.y !== videoHeight) {
        if (this.videoSize.x) {
          this.texture.dispose()
          this.texture = new THREE.VideoTexture(this.video)
          this.background.material.uniforms.cameraFrame!.value = this.texture
        }
        this.videoSize.set(videoWidth, videoHeight)
      }
      const cover = coverScale(videoWidth / videoHeight, this.aspect)
      this.background.material.uniforms.cover!.value.set(cover.x, cover.y)
      this.background.material.uniforms.flash!.value = flash
    }

    const scale = Math.min(1.12, .64 + this.aspect * .27)
    const idleX = 1.36 * this.aspect
    const idleY = -1.31 - .20 * Math.max(0, 1 - this.aspect)
    this.view.position.set(idleX, idleY + Math.sin(now * .0021) * .025, 0)
    this.view.rotation.set(.12, -.34, .49)
    this.view.scale.setScalar(scale)
    this.weapons.forEach((model, index) => { model.visible = equipment[index]!.id === weapon.id })
    this.arrow.visible = false
    let draw = 0

    if (strike) {
      const p = Math.min(1, (now - strike.start) / weapon.duration)
      const { x, y } = strike.direction
      const push = smooth(p / .32) * (1 - smooth((p - .32) / .68))
      if (weapon.id === 'sword') {
        const windup = Math.sin(Math.PI * Math.min(1, p / .18)) * .19
        this.view.position.x += windup - push * this.aspect * (.82 - x * .20)
        this.view.position.y += push * (.56 + y * .48)
        this.view.rotation.set(.12 - push * .85, -.34 + push * .91, .49 + push * (1.58 - x * .34) - windup)
      } else if (weapon.id === 'hammer') {
        const lift = smooth(p / .35) * (1 - smooth((p - .35) / .16))
        const slam = smooth((p - .35) / .14) * (1 - smooth((p - .55) / .45))
        this.view.position.x -= (lift * .18 + slam * (.69 - x * .18)) * this.aspect
        this.view.position.y += lift * .84 - slam * (.51 - y * .17)
        this.view.rotation.set(.12 - lift * .72 + slam * 1.45, -.34 + slam * .51, .49 - lift * .58 + slam * .77)
      } else {
        const release = weapon.release / weapon.duration
        const raised = smooth(p / .32) * (1 - smooth((p - release) / (1 - release)))
        draw = p < release ? smooth(p / release) : 1 - smooth((p - release) / .095)
        this.view.position.x -= raised * this.aspect * .57
        this.view.position.y += raised * .60
        this.view.rotation.set(.12 + raised * .12, -.34 - raised * .45, .49 - raised * (.36 - x * .25))
        const flight = Math.max(0, (p - release) * weapon.duration / (weapon.impact - weapon.release))
        this.arrow.visible = flight < 1
        const originX = this.view.position.x - .30 * scale
        const originY = this.view.position.y + draw * .19
        this.arrow.position.set(originX * (1 - flight), originY * (1 - flight), .45)
        this.arrow.rotation.set(.28 + flight, -.3, Math.atan2(originX, -originY))
        this.arrow.scale.setScalar(scale * (.92 - flight * .78))
      }
    }
    if (weapon.id === 'bow') this.string.draw(draw)
    this.gl.render(this.scene, this.camera)
  }

  dispose() {
    this.clearDefeat()
    this.burst.dispose()
    this.texture.dispose()
    this.mask?.dispose()
    this.emptyMask.dispose()
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      for (const material of [object.material].flat()) material.dispose()
    })
    this.gl.dispose()
  }
}

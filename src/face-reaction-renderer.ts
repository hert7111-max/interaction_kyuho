import * as THREE from 'three'
import { coverScale } from './water-math'
import { fatigue, maxImpacts, reboundAt } from './face-reaction-engine'
import type { FaceFrame, FaceReaction } from './face-reaction-engine'

const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0., 1.);
}
`

const fragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVideo, uSkinMask;
uniform vec2 uCover, uCenter, uAxis;
uniform vec3 uEyes[2];
uniform vec4 uSkinBounds;
uniform vec4 uMarks[8], uImpactPosition[3], uImpactMotion[3];
uniform int uMarkCount, uImpactCount;
uniform float uAspect, uWidth, uHeight, uReady, uVisible, uHollow, uShadows;

float ellipse(vec2 p, vec2 radius) {
  vec2 d = p / radius;
  return dot(d, d);
}

void main() {
  if (uReady < .5) {
    gl_FragColor = vec4(0.);
    return;
  }
  vec2 screen = (vUv - .5) * uCover + .5;
  vec2 camera = vec2((1. - screen.x) * uAspect, 1. - screen.y);
  float bruiseAlpha = 0.;
  vec3 bruiseTint = vec3(1.);
  float underEye = 0.;
  if (uVisible > .5) {
    vec2 down = vec2(-uAxis.y, uAxis.x);
    vec2 fromCenter = (camera - uCenter) / uWidth;
    vec2 material = vec2(dot(fromCenter, uAxis), dot(fromCenter, down));
    if (abs(material.x) < 1.25 && abs(material.y) < uHeight) {
      vec2 sampleAt = material;
      float cheek = exp(-ellipse(material - vec2(0., uHeight * .16), vec2(.56, uHeight * .32)));
      sampleAt.x *= 1. + 1.05 * uHollow * cheek;

      // A broad recoil and a narrower travelling wave share the same elastic impulse.
      vec2 motion = vec2(0.);
      for (int i = 0; i < 3; i++) {
        if (i >= uImpactCount) break;
        vec4 impact = uImpactPosition[i];
        vec4 flex = uImpactMotion[i];
        vec2 offset = material - impact.xy;
        float distance = length(offset * vec2(1., .86));
        if (distance > .87) continue;
        float push = 1. - smoothstep(.01, .66, distance);
        float shell = (distance - impact.z) / .13;
        float ripple = max(0., 1. - abs(shell));
        motion += flex.xy * (flex.z * push * push * .19);
        motion += offset * (flex.z * push * .25);
        motion += offset / max(distance, .035) * (ripple * ripple * shell * flex.w * .22);
      }
      float falloff = 1. - smoothstep(.62, 1.42, ellipse(material, vec2(.76, uHeight * .61)));
      sampleAt += motion * falloff;

      vec2 dents = vec2(0.);
      for (int i = 0; i < 8; i++) {
        if (i >= uMarkCount) break;
        vec4 mark = uMarks[i];
        vec2 delta = sampleAt - mark.xy;
        float distance = ellipse(delta, vec2(.24, .21));
        if (distance >= 1.) continue;
        float local = 1. - smoothstep(0., 1., distance);
        dents += delta * local * local * mark.z * .73;
      }
      sampleAt += dents;

      for (int i = 0; i < 8; i++) {
        if (i >= uMarkCount) break;
        vec4 mark = uMarks[i];
        vec2 delta = sampleAt - mark.xy;
        float size = .82 + mark.z * .34;
        float distance = ellipse(delta, vec2(.187, .151) * size);
        if (distance > 1.28) continue;
        float grain = sin(delta.x * 73. + delta.y * 44.) * cos(delta.y * 60. - delta.x * 23.);
        float edge = distance + grain * .11 + .06 * sin(delta.x * 30. - delta.y * 67.);
        float halo = 1. - smoothstep(.16, 1.18, edge);
        float core = 1. - smoothstep(.035, .53, edge);
        float stain = halo * (.38 + mark.z * .55) * (.87 + .13 * grain);
        if (stain <= bruiseAlpha) continue;
        vec3 plum = mix(vec3(.70, .41, .68), vec3(.31, .13, .44), core);
        vec3 warm = mix(vec3(.94, .57, .54), vec3(.69, .22, .30), core);
        bruiseTint = mix(plum, warm, min(.92, mark.w * 1.32));
        bruiseAlpha = stain;
      }

      if (uShadows > .005) {
        for (int i = 0; i < 2; i++) {
          vec3 eye = uEyes[i];
          vec2 delta = sampleAt - eye.xy;
          float horizontal = delta.x / eye.z;
          if (abs(horizontal) > 1.65 || delta.y < -.02 || delta.y > .18) continue;
          // The crescent follows the lower lid and stays clear of the eyeball.
          float depth = delta.y + .039 * min(1.6, horizontal * horizontal);
          float edge = smoothstep(-.014, .018, delta.y);
          float core = exp(-dot(vec2(horizontal * .93, (depth - .047) / .041),
                               vec2(horizontal * .93, (depth - .047) / .041)));
          float trough = exp(-dot(vec2(horizontal * .74, (depth - .079) / .066),
                                 vec2(horizontal * .74, (depth - .079) / .066)));
          underEye = max(underEye, min(.93, (.94 * core + .40 * trough) * edge * uShadows));
        }
      }
      camera = uCenter + (uAxis * sampleAt.x + down * sampleAt.y) * uWidth;
    }
  }
  if (bruiseAlpha > 0. || underEye > 0.) {
    // Clip the pigment in source video coordinates, after the rubber warp.
    vec2 maskUV = (camera - uSkinBounds.xy) * uSkinBounds.zw;
    float skin = texture2D(uSkinMask, vec2(maskUV.x, 1. - maskUV.y)).a;
    bruiseAlpha *= skin;
    underEye *= skin;
  }
  vec2 uv = clamp(vec2(camera.x / uAspect, 1. - camera.y), vec2(.001), vec2(.999));
  vec3 rgb = texture2D(uVideo, uv).rgb;
  rgb = mix(rgb, rgb * bruiseTint + vec3(.026, .009, .036), bruiseAlpha);
  rgb = mix(rgb, rgb * vec3(.33, .20, .40) + vec3(.032, .010, .044), underEye);
  gl_FragColor = vec4(rgb, 1.);
}
`

export class FaceReactionRenderer {
  private gl: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.Camera()
  private texture: THREE.VideoTexture
  private geometry = new THREE.PlaneGeometry(2, 2)
  private material: THREE.ShaderMaterial
  private marks = Array.from({ length: 8 }, () => new THREE.Vector4())
  private impactLocations = Array.from({ length: maxImpacts }, () => new THREE.Vector4())
  private impactMotion = Array.from({ length: maxImpacts }, () => new THREE.Vector4())
  private lastRender = -Infinity
  private faceVisible = false
  private eyes = [new THREE.Vector3(), new THREE.Vector3()]
  private maskCanvas = Object.assign(document.createElement('canvas'), { width: 96, height: 144 })
  private maskContext = this.maskCanvas.getContext('2d')
  private skinMask = new THREE.CanvasTexture(this.maskCanvas)
  private skinFace: FaceFrame | null = null
  private video: HTMLVideoElement
  private screenAspect = 1
  private width = 0
  private height = 0
  private hollow = 0
  private shadows = 0

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.video = video
    this.gl = new THREE.WebGLRenderer({ canvas, alpha: true, powerPreference: 'low-power', antialias: false })
    this.gl.setClearColor(0x000000, 0)
    this.texture = new THREE.VideoTexture(video)
    this.skinMask.generateMipmaps = false
    this.skinMask.minFilter = THREE.LinearFilter
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, depthTest: false, depthWrite: false,
      uniforms: {
        uVideo: { value: this.texture }, uCover: { value: new THREE.Vector2(1, 1) },
        uCenter: { value: new THREE.Vector2() }, uAxis: { value: new THREE.Vector2(1, 0) },
        uSkinMask: { value: this.skinMask }, uSkinBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
        uEyes: { value: this.eyes }, uMarks: { value: this.marks }, uMarkCount: { value: 0 },
        uImpactPosition: { value: this.impactLocations }, uImpactMotion: { value: this.impactMotion },
        uImpactCount: { value: 0 },
        uReady: { value: 0 }, uAspect: { value: 1 }, uVisible: { value: 0 },
        uWidth: { value: 1 }, uHeight: { value: 1.4 }, uHollow: { value: 0 }, uShadows: { value: 0 },
      },
    })
    const quad = new THREE.Mesh(this.geometry, this.material)
    quad.frustumCulled = false
    this.scene.add(quad)
    this.resize()
  }

  resize() {
    const canvas = this.gl.domElement
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
    this.screenAspect = w / h
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(2_200_000 / (w * h))))
    this.gl.setSize(w, h, false)
  }

  private updateSkinMask(face: FaceFrame) {
    if (face === this.skinFace) return
    this.skinFace = face
    const ctx = this.maskContext
    if (!ctx) return
    const { width, height } = this.maskCanvas
    ctx.clearRect(0, 0, width, height)
    this.skinMask.needsUpdate = true
    if (face.outline.length < 3) return

    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const point of face.outline) {
      left = Math.min(left, point.x)
      top = Math.min(top, point.y)
      right = Math.max(right, point.x)
      bottom = Math.max(bottom, point.y)
    }
    const pad = face.width * .035
    left -= pad
    right += pad
    top -= pad
    bottom += pad
    const sx = 1 / (right - left), sy = 1 / (bottom - top)
    this.material.uniforms.uSkinBounds!.value.set(left, top, sx, sy)
    const cx = (left + right) * .5, cy = (top + bottom) * .5
    // Nested contours soften the edge only on the inside and leave the padded border transparent.
    ctx.fillStyle = '#fff'
    const opacity = [.25, 1 / 3, .5, 1]
    for (const [index, alpha] of opacity.entries()) {
      const size = .985 - index * .019
      ctx.globalAlpha = alpha
      ctx.beginPath()
      face.outline.forEach((point, vertex) => {
        const x = (cx + (point.x - cx) * size - left) * sx * width
        const y = (cy + (point.y - cy) * size - top) * sy * height
        if (vertex === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  clear() {
    this.hollow = this.shadows = 0
    this.lastRender = -Infinity
    this.faceVisible = false
    this.gl.clear()
  }

  render(now: number, face: FaceFrame | null, engine: FaceReaction) {
    const video = this.video
    const ready = video.readyState >= 2 && !!video.srcObject
    const uniforms = this.material.uniforms
    uniforms.uReady!.value = Number(ready)
    if (ready) {
      if (this.width && (video.videoWidth !== this.width || video.videoHeight !== this.height)) {
        this.texture.dispose()
        this.texture = new THREE.VideoTexture(video)
        uniforms.uVideo!.value = this.texture
      }
      this.width = video.videoWidth
      this.height = video.videoHeight
      const aspect = this.width / this.height
      const cover = coverScale(aspect, this.screenAspect)
      uniforms.uAspect!.value = aspect
      uniforms.uCover!.value.set(cover.x, cover.y)
    }
    const delta = Math.min(120, now - this.lastRender)
    const ease = 1 - Math.exp(-delta / 115)
    this.lastRender = now
    const visible = !!face && engine.hits > 0
    uniforms.uVisible!.value = Number(visible)
    if (face && visible) {
      this.updateSkinMask(face)
      // Blend the lower-rate face samples at the display rate.
      const fit = this.faceVisible ? 1 - Math.exp(-delta / 24) : 1
      const center = uniforms.uCenter!.value as THREE.Vector2
      center.set(center.x + (face.center.x - center.x) * fit, center.y + (face.center.y - center.y) * fit)
      const axis = uniforms.uAxis!.value as THREE.Vector2
      axis.set(axis.x + (face.right.x - axis.x) * fit, axis.y + (face.right.y - axis.y) * fit).normalize()
      uniforms.uWidth!.value += (face.width - uniforms.uWidth!.value) * fit
      uniforms.uHeight!.value += (face.height - uniforms.uHeight!.value) * fit
      face.eyes.forEach((point, i) => {
        const eye = this.eyes[i]!
        eye.set(eye.x + (point.x - eye.x) * fit, eye.y + (point.y - eye.y) * fit, eye.z + (point.span - eye.z) * fit)
      })
      const target = fatigue(engine.hits)
      this.hollow += (target.hollow - this.hollow) * ease
      this.shadows += (target.shadows - this.shadows) * ease
      uniforms.uHollow!.value = this.hollow
      uniforms.uShadows!.value = this.shadows
      uniforms.uMarkCount!.value = engine.marks.length
      for (const [index, mark] of engine.marks.entries()) {
        this.marks[index]!.set(mark.point.x, mark.point.y, mark.strength, Math.exp(-Math.max(0, now - mark.time) / 510))
      }
      let impacts = 0
      for (const impact of engine.impacts) {
        const rebound = reboundAt(now - impact.time)
        if (!rebound) continue
        this.impactLocations[impacts]!.set(impact.point.x, impact.point.y, rebound.radius, 0)
        this.impactMotion[impacts]!.set(
          impact.direction.x, impact.direction.y, rebound.compression * impact.strength, rebound.wave * impact.strength,
        )
        impacts++
      }
      uniforms.uImpactCount!.value = impacts
    }
    this.faceVisible = visible
    this.gl.render(this.scene, this.camera)
  }

  dispose() {
    this.texture.dispose()
    this.skinMask.dispose()
    this.material.dispose()
    this.geometry.dispose()
    this.gl.dispose()
  }
}

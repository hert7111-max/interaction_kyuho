import * as THREE from 'three'
import { burstDuration, sampleShards, shardLimit } from './minecraft-shards'
import type { PersonMask } from './minecraft-combat'

export class PersonBurst {
  readonly mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), shardLimit,
  )
  private scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  private block = new THREE.Object3D()
  private tint = new THREE.Color()
  private startsAt = -Infinity
  private pieces: (ReturnType<typeof sampleShards>[number] & { vx: number; vy: number; spin: number })[] = []

  constructor() {
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  start(video: HTMLVideoElement, mask: PersonMask, coverX: number, coverY: number, now: number) {
    const ctx = this.scratch
    if (!ctx || video.readyState < 2) return
    const scale = 192 / Math.max(video.videoWidth, video.videoHeight)
    const width = Math.max(1, Math.round(video.videoWidth * scale))
    const height = Math.max(1, Math.round(video.videoHeight * scale))
    ctx.canvas.width = width
    ctx.canvas.height = height
    ctx.drawImage(video, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height)
    const shards = sampleShards(mask, pixels, coverX, coverY)
    this.pieces = shards.map(shard => ({
      ...shard,
      vx: (shard.x - .5) * 1.45 + (Math.random() - .5) * .70,
      vy: -.35 - Math.random() * .55 + (shard.y - .38) * .45,
      spin: (Math.random() - .5) * 18,
    }))
    this.startsAt = now
    this.mesh.count = shards.length
    shards.forEach(({ r, g, b }, index) => {
      this.tint.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
      this.mesh.setColorAt(index, this.tint)
    })
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  active(now: number) {
    return this.pieces.length > 0 && now >= this.startsAt && now - this.startsAt < burstDuration
  }

  update(now: number, aspect: number) {
    this.mesh.visible = this.active(now)
    if (!this.mesh.visible) return
    const seconds = (now - this.startsAt) / 1000
    const shrink = Math.min(1, 2.4 * (1 - seconds / (burstDuration / 1000)))
    for (const [i, fragment] of this.pieces.entries()) {
      const x = fragment.x + fragment.vx * seconds
      const y = fragment.y + fragment.vy * seconds + .76 * seconds ** 2
      const size = 4.2 * fragment.size * Math.min(1, aspect) * .78 * shrink
      this.block.position.set((x - .5) * 4.2 * aspect, (.5 - y) * 4.2, -.65 + (i % 17) * .024)
      this.block.rotation.set(seconds * fragment.spin, seconds * fragment.spin * .77, seconds * fragment.spin * 1.32)
      this.block.scale.set(size, size, size)
      this.block.updateMatrix()
      this.mesh.setMatrixAt(i, this.block.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  clear() {
    this.pieces = []
    this.mesh.visible = false
  }

  dispose() { this.mesh.dispose() }
}

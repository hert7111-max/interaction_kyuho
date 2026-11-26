export type Landmark = { x: number; y: number; visibility?: number }
type Pose = Landmark[]
type Sample = { x: number; y: number; scale: number; gap: number; overhead: boolean }
type History = { sample: Sample; armedAt: number; seenAt: number }

function clapSample(pose: Pose, aspect: number): Sample | null {
  const has = (index: number, score = .45) => {
    const point = pose[index]
    return point && (point.visibility ?? 1) >= score && Number.isFinite(point.x) && Number.isFinite(point.y)
  }
  if (![0, 11, 12].every(index => has(index))) return null
  const nose = pose[0]!, left = pose[11]!, right = pose[12]!
  const x = (left.x + right.x) * .5 * aspect, y = (left.y + right.y) * .5
  const shoulder = Math.hypot((left.x - right.x) * aspect, left.y - right.y)
  const scale = Math.max(shoulder, (y - nose.y) * 1.5)
  if (scale < .035) return null
  if (!has(15) || !has(16)) return { x, y, scale, gap: Infinity, overhead: false }
  const palm = (wristIndex: number, fingerIndex: number) => {
    const wrist = pose[wristIndex]!
    if (!has(fingerIndex, .55)) return wrist
    const finger = pose[fingerIndex]!
    return { x: (wrist.x + finger.x) * .5, y: (wrist.y + finger.y) * .5 }
  }
  const a = palm(15, 19), b = palm(16, 20)
  const above = nose.y - Math.max(.012, (y - nose.y) * .22)
  const overhead = Math.max(a.y, b.y) < above &&
    Math.abs(((a.x + b.x) * .5 - nose.x) * aspect) < scale * 1.2
  const gap = Math.hypot((a.x - b.x) * aspect, a.y - b.y) / scale
  return { x, y, scale, gap, overhead }
}

export class OverheadClap {
  private tracks: History[] = []
  private lastClap = -Infinity

  update(poses: Pose[], aspect: number, now: number) {
    const available = this.tracks.slice()
    const next: History[] = []
    let trigger = false
    for (const pose of poses) {
      const sample = clapSample(pose, aspect)
      if (!sample) continue
      let index = -1
      let limit = sample.scale * .65
      for (const [i, previous] of available.entries()) {
        const delta = Math.hypot(sample.x - previous.sample.x, sample.y - previous.sample.y)
        if (now - previous.seenAt <= 460 && delta < limit) {
          index = i
          limit = delta
        }
      }
      const previous = index >= 0 ? available.splice(index, 1)[0] : undefined
      let armedAt = previous?.armedAt ?? -Infinity
      if (!sample.overhead) armedAt = -Infinity
      else if (sample.gap >= .68) armedAt = now
      else if (sample.gap <= .34) {
        if (now - armedAt <= 1050 && now - this.lastClap >= 700) {
          trigger = true
          this.lastClap = now
        }
        armedAt = -Infinity
      }
      next.push({ sample, armedAt, seenAt: now })
    }
    this.tracks = next.concat(available.filter(history => now - history.seenAt <= 460)).slice(0, 8)
    return trigger
  }

  reset() {
    this.tracks = []
    this.lastClap = -Infinity
  }
}

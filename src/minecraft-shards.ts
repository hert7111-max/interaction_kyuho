import { maskThreshold } from './minecraft-combat.ts'
import type { PersonMask } from './minecraft-combat.ts'

export const shardLimit = 180
export const burstDuration = 1250

export type Shard = { x: number; y: number; r: number; g: number; b: number; size: number }

/** Stratified samples retain local colors, including hair, skin, and clothing. */
export function sampleShards(mask: PersonMask, colors: ImageData, coverX: number, coverY: number): Shard[] {
  const samples: Shard[] = []
  const grid = Math.max(13, Math.ceil(Math.sqrt(shardLimit * 2)))
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = (col + .5) / grid
      const y = (row + .5) / grid
      const u = .5 + (.5 - x) * coverX
      const v = .5 + (y - .5) * coverY
      const mx = Math.min(mask.width - 1, Math.floor(u * mask.width))
      const my = Math.min(mask.height - 1, Math.floor(v * mask.height))
      if (mask.pixels[my * mask.width + mx]! < maskThreshold * 255) continue
      const index = (Math.floor(v * colors.height) * colors.width + Math.floor(u * colors.width)) * 4
      samples.push({
        x, y, r: colors.data[index]!, g: colors.data[index + 1]!, b: colors.data[index + 2]!,
        size: 1 / grid,
      })
    }
  }
  if (samples.length <= shardLimit) return samples
  // Preserve the full height and width instead of clipping the last rows.
  return Array.from({ length: shardLimit }, (_, index) =>
    samples[Math.floor((index + .5) * samples.length / shardLimit)]!)
}

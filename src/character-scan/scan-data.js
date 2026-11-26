import { CONFIG } from '../config.js'
import { readSubjectPixel, sampleShirt, sampleHair } from './appearance-scan.js'

const scan = CONFIG.scan
const names = ['skin', 'hair', 'top']
const channels = ['r', 'g', 'b']
const styleKeys = ['hair', 'top', 'pattern']
const look = scan.appearance
const rgb = values => Object.fromEntries(values.map((value, i) => [channels[i], Math.round(value)]))
const average = colors => colors[0]?.map((_, i) => colors.reduce((sum, color) => sum + color[i], 0) / colors.length)
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const valid = point => point && point.x >= 0 && point.x < 1 && point.y >= 0 && point.y < 1 &&
  (point.visibility ?? 1) >= scan.minimumVisibility

function ellipseColor(read, center, axis, across, along) {
  let count = 0
  const sum = [0, 0, 0]
  for (let row = 0; row < scan.taps; row++) {
    const v = (row + .5) * 2 / scan.taps - 1
    for (let col = 0; col < scan.taps; col++) {
      const u = (col + .5) * 2 / scan.taps - 1
      if (u * u + v * v > 1) continue
      const x = center.x + u * across * axis.y + v * along * axis.x
      const y = center.y - u * across * axis.x + v * along * axis.y
      const pixel = read(x, y)
      if (!pixel) continue
      for (let channel = 0; channel < channels.length; channel++) sum[channel] += pixel[channel]
      count++
    }
  }
  return count >= scan.minimumColorTaps ? sum.map(value => value / count) : null
}

export function sampleScanFrame(landmarks, frame, mask) {
  if (!landmarks || landmarks.length < scan.upperLandmarkCount) return null
  const at = index => valid(landmarks[index])
    ? { x: landmarks[index].x * frame.width, y: landmarks[index].y * frame.height }
    : null
  const joints = scan.joints
  const read = (x, y) => readSubjectPixel(frame, mask, x, y)
  const shoulders = joints.shoulders.map(at)
  const nose = at(joints.nose)
  const eyes = joints.eyes.map(at)
  const ears = joints.ears.map(at)
  const eye = eyes.every(Boolean) ? mid(...eyes) : null
  const headWidth = ears.every(Boolean) ? distance(...ears) : eye ? distance(...eyes) * look.headFromEyes : 0

  // Collect regions independently so a briefly obscured joint does not discard the rest of a frame.
  const sample = { shoulderRatio: null, colors: {}, appearance: {} }
  const shoulder = shoulders.every(Boolean) ? mid(...shoulders) : null
  const shoulderWidth = shoulder ? distance(...shoulders) : 0
  let chestEnd = null
  if (shoulderWidth > 0) {
    const area = scan.clothesPatch
    const [left, right] = shoulders[0].x <= shoulders[1].x ? shoulders : [...shoulders].reverse()
    const down = { x: (left.y - right.y) / shoulderWidth, y: (right.x - left.x) / shoulderWidth }
    const xRoom = down.x > 0 ? (frame.width - 1 - shoulder.x) / down.x
      : down.x < 0 ? -shoulder.x / down.x : Infinity
    const yRoom = down.y > 0 ? (frame.height - 1 - shoulder.y) / down.y : Infinity
    const depth = Math.min(shoulderWidth * area.depthFromShoulders, xRoom, yRoom)
    if (depth >= shoulderWidth * area.minimumDepth) {
      chestEnd = { x: shoulder.x + down.x * depth, y: shoulder.y + down.y * depth }
      sample.colors.top = ellipseColor(
        read, mix(shoulder, chestEnd, area.center), down, shoulderWidth * area.width / 2, depth * area.length / 2,
      )
      const torso = headWidth ? headWidth * area.headToTorso : shoulderWidth * area.depthFromShoulders
      sample.shoulderRatio = shoulderWidth * scan.torsoReference / torso
    }
  }
  if (nose && eye) {
    const from = shoulder ?? nose
    const length = distance(from, eye)
    if (headWidth > 0 && length > 0) {
      const up = { x: (eye.x - from.x) / length, y: (eye.y - from.y) / length }
      const patch = scan.nosePatch, cheek = scan.cheekPatch, crown = scan.crownPatch
      const center = ellipseColor(
        read, { x: nose.x - up.x * headWidth * patch.down, y: nose.y - up.y * headWidth * patch.down },
        up, headWidth * patch.x, headWidth * patch.y,
      )
      const cheeks = ears.filter(Boolean).map(ear => {
        const point = mix(nose, ear, cheek.across)
        return ellipseColor(read, {
          x: point.x - up.x * headWidth * cheek.down, y: point.y - up.y * headWidth * cheek.down,
        }, up, headWidth * cheek.x, headWidth * cheek.y)
      })
      sample.colors.skin = average([center, ...cheeks].filter(Boolean)) ?? null
      sample.colors.hair = ellipseColor(
        read, { x: eye.x + up.x * headWidth * crown.up, y: eye.y + up.y * headWidth * crown.up },
        up, headWidth * crown.x, headWidth * crown.y,
      )
      if (mask && sample.colors.skin) {
        const { hairColor, ...appearance } = sampleHair(read, eye, up, headWidth, sample.colors.skin)
        Object.assign(sample.appearance, appearance)
        if (hairColor) sample.colors.hair = hairColor
        if (appearance.hair === 'bare') sample.colors.hair = null
      }
    }
  }
  if (sample.colors.skin && chestEnd) Object.assign(sample.appearance, sampleShirt(read, {
    shoulders, chestEnd, elbows: joints.elbows.map(at), wrists: joints.wrists.map(at),
  }, sample.colors))
  return sample
}

function generateOutfit(topColor, sleeve, random) {
  const presets = scan.generatedOutfit
  const { r, g, b } = topColor
  const variants = (r + g + b) / 3 >= presets.lightTopThreshold ? presets.lightTop : presets.darkTop
  const outfit = variants[Math.floor(random() * variants.length)]
  const bottom = sleeve === 'sleeveless' ? 'shorts' : sleeve === 'long' ? 'trousers' : outfit.style
  return { bottom, pantsColor: rgb(outfit.pants), shoeColor: rgb(outfit.shoes) }
}

export function createScanAccumulator(random = Math.random) {
  const sums = Object.fromEntries(names.map(name => [name, { count: 0, total: [0, 0, 0] }]))
  const styles = Object.fromEntries(styleKeys.map(key => [key, new Map()]))
  const patternColors = new Map()
  const parts = new Map()
  let frames = 0
  let shoulderTotal = 0, shoulderSamples = 0
  let outfit
  const addTo = (name, items) => {
    if (!items) return
    sums[name].count++
    items.forEach((value, i) => { sums[name].total[i] += value })
  }
  const mean = name => sums[name].total.map(value => value / sums[name].count)
  const vote = key => {
    const counts = Array.from(styles[key])
    const total = counts.reduce((sum, [, count]) => sum + count, 0)
    const winner = counts.sort(([, a], [, b]) => b - a)[0]
    return winner && winner[1] >= look.minimumStyleSamples && winner[1] / total >= look.styleAgreement
      ? winner[0] : look.defaults[key]
  }
  return {
    add(sample) {
      if (!sample) return
      frames++
      if (Number.isFinite(sample.shoulderRatio)) {
        shoulderTotal += sample.shoulderRatio
        shoulderSamples++
      }
      for (const name of names) addTo(name, sample.colors[name])
      const appearance = sample.appearance
      if (!appearance) return
      for (const key of styleKeys) {
        const value = appearance[key]
        if (value) styles[key].set(value, (styles[key].get(value) ?? 0) + 1)
      }
      if (appearance.part) parts.set(appearance.hair, (parts.get(appearance.hair) ?? 0) + appearance.part)
      if (appearance.topBase && appearance.topAccent) {
        const bucket = patternColors.get(appearance.pattern) ?? { count: 0, base: [0, 0, 0], accent: [0, 0, 0] }
        bucket.count++
        for (let i = 0; i < channels.length; i++) {
          bucket.base[i] += appearance.topBase[i]
          bucket.accent[i] += appearance.topAccent[i]
        }
        patternColors.set(appearance.pattern, bucket)
      }
    },
    finish() {
      if (Math.min(shoulderSamples, sums.skin.count, sums.top.count) < scan.minimumSamples) return null
      const appearance = Object.fromEntries(styleKeys.map(key => [key, vote(key)]))
      appearance.part = Math.sign(parts.get(appearance.hair) ?? 0) || 1
      const pattern = patternColors.get(appearance.pattern)
      if (pattern) {
        appearance.topBase = rgb(pattern.base.map(channel => channel / pattern.count))
        appearance.topAccent = rgb(pattern.accent.map(channel => channel / pattern.count))
      }
      const colors = Object.fromEntries(names.map(name => [
        name, rgb(sums[name].count ? mean(name) : look.defaults.hairColor),
      ]))
      outfit ??= generateOutfit(appearance.topBase ?? colors.top, appearance.top, random)
      return {
        proportions: {
          shoulderWidth: shoulderTotal / shoulderSamples,
          torsoLength: scan.torsoReference,
          legLength: CONFIG.character.geometry.legReference,
        },
        colors: { ...colors, bottom: outfit.pantsColor },
        appearance: { ...appearance, bottom: outfit.bottom, footwear: 'shoes', shoeColor: outfit.shoeColor },
        samples: { frames, proportions: shoulderSamples, ...Object.fromEntries(Object.entries(sums).map(([name, item]) => [name, item.count])) },
      }
    },
  }
}

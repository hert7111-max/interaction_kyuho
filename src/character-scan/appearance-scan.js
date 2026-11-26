import { CONFIG } from '../config.js'

const scan = CONFIG.scan
const settings = scan.appearance
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const average = colors => [0, 1, 2].map(channel =>
  colors.reduce((sum, color) => sum + color[channel], 0) / colors.length)
const difference = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / (Math.sqrt(3) * 255)

export function readSubjectPixel(frame, mask, x, y) {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null
  if (mask) {
    const i = Math.floor(y * mask.height / frame.height) * mask.width +
      Math.floor(x * mask.width / frame.width)
    if (mask.pixels[i] < scan.maskConfidence * 255) return null
  }
  const offset = (Math.floor(y) * frame.width + Math.floor(x)) * 4
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]]
}

function resemblesSkin(color, skin) {
  const [r, g, b] = color
  const [sr, sg, sb] = skin
  const brightness = (sr + sg + sb) / (3 * 255)
  const range = Math.min(settings.skinRange, settings.darkSkinRange + brightness * settings.skinRangeSlope)
  const chroma = Math.max(Math.abs((r - g) - (sr - sg)), Math.abs((g - b) - (sg - sb))) / 255
  return difference(color, skin) <= range && chroma <= settings.skinChroma
}

function isExposedSkin(color, skin, cloth) {
  if (resemblesSkin(color, skin)) return true
  const intensity = color[0] + color[1] + color[2]
  const reference = skin[0] + skin[1] + skin[2]
  const [low, high] = settings.skinShading
  const shade = intensity / reference
  if (shade < low || shade > high || !intensity || !reference) return false
  if (cloth && difference(color, cloth) < difference(color, skin) * settings.clothSeparation) return false
  return color.every((channel, i) => Math.abs(channel / intensity - skin[i] / reference) <= settings.skinHueRange)
}

export function sampleHair(read, eye, up, width, skin) {
  const point = (u, v) => read(eye.x + (up.x * v - up.y * u) * width, eye.y + (up.y * v + up.x * u) * width)
  const rows = settings.crownRows.map(v => settings.crownColumns.map(u => point(u, v)))
  const hits = rows.map(row => row.map(color => color && !resemblesSkin(color, skin) ? color : null))
  const hairPixels = hits.flat().filter(Boolean)
  if (hairPixels.length < settings.minimumCrownHits) {
    const skinHits = rows.flat().filter(color => color && resemblesSkin(color, skin)).length
    return skinHits >= settings.minimumCrownHits ? { hair: 'bare' } : {}
  }

  // The median keeps bright highlights and stray edge pixels from choosing the hair palette.
  const hairColor = [0, 1, 2].map(i => {
    const sorted = hairPixels.map(color => color[i]).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  })
  const matchesHair = color => color && !resemblesSkin(color, skin) && difference(color, hairColor) <= settings.hairRange
  const sides = [-1, 1].map(side =>
    settings.templeRows.filter(v => settings.templeColumns.some(u => matchesHair(point(side * u, v)))).length)
  if (Math.max(...sides) / settings.templeRows.length >= settings.sideCoverage) {
    return { hair: 'long', hairColor, part: sides[1] > sides[0] ? 1 : -1 }
  }

  const center = Math.floor(settings.crownColumns.length / 2)
  const lowerRows = hits.filter((_, i) => settings.crownRows[i] <= settings.lowFringe)
  const fringe = [lowerRows.flatMap(row => row.slice(0, center)), lowerRows.flatMap(row => row.slice(center + 1))]
    .map(side => side.filter(Boolean).length / side.length)
  const imbalance = fringe[1] - fringe[0]
  if (Math.abs(imbalance) >= settings.partImbalance) return { hair: 'parted', hairColor, part: Math.sign(imbalance) }
  const raised = hits.some((row, i) => settings.crownRows[i] >= settings.raisedCrown && row.filter(Boolean).length >= 2)
  return { hair: raised || Math.min(...fringe) > settings.sideCoverage ? 'full' : 'cropped', hairColor }
}

function skinCoverage(read, from, to, bodyWidth, stops, skin, cloth) {
  if (!from || !to) return null
  const dx = to.x - from.x, dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < bodyWidth * settings.minimumLimbLength) return null
  const votes = []
  for (const t of stops) {
    const { x, y } = mix(from, to, t)
    const cross = settings.limbOffsets.map(offset =>
      read(x - dy / length * offset * bodyWidth, y + dx / length * offset * bodyWidth)).filter(Boolean)
    if (cross.length) votes.push(cross.filter(color => isExposedSkin(color, skin, cloth)).length > cross.length / 2)
  }
  return votes.length >= settings.minimumLimbVotes ? votes.filter(Boolean).length / votes.length : null
}

export function sampleShirt(read, joints, colors) {
  const { shoulders, chestEnd, elbows, wrists } = joints
  const { skin, top } = colors
  if (!shoulders.every(Boolean)) return {}
  const shoulder = mix(...shoulders, .5)
  const width = Math.hypot(shoulders[1].x - shoulders[0].x, shoulders[1].y - shoulders[0].y)
  if (!width) return {}
  const coverage = (from, to, stops) => from.flatMap((point, i) => {
    const result = skinCoverage(read, point, to[i], width, stops, skin, top)
    return result === null ? [] : [result]
  })
  const upper = coverage(shoulders, elbows, settings.armUpper)
  const lower = coverage(elbows, wrists, settings.armLower)
  const look = {}
  if (upper.length) {
    const shoulderSkin = coverage(shoulders, elbows, settings.armShoulder)
    if (Math.max(...upper) <= settings.covered && (!lower.length || Math.min(...lower) <= settings.covered)) look.top = 'long'
    else if (shoulderSkin.some(value => value >= settings.exposed) && Math.max(...upper) >= settings.exposed) look.top = 'sleeveless'
    else look.top = 'short'
  }
  const dx = chestEnd.x - shoulder.x, dy = chestEnd.y - shoulder.y
  const length = Math.hypot(dx, dy)
  const rows = settings.shirtRows.map(t => {
    const { x, y } = mix(shoulder, chestEnd, t)
    const row = settings.shirtColumns.map(offset => read(x + dy / length * offset * width, y - dx / length * offset * width))
      .filter(color => color && !resemblesSkin(color, skin))
    if (row.length < settings.shirtColumns.length - 1) return null
    const color = average(row)
    return row.every(pixel => difference(pixel, color) < settings.panelVariation) ? color : null
  })
  const [a, b, c, d] = rows
  if (a && b && c && d && difference(a, d) < settings.panelVariation &&
      difference(b, a) > settings.panelDifference && difference(b, c) < settings.panelVariation) {
    Object.assign(look, { pattern: 'band', topBase: average([a, d]), topAccent: average([b, c]) })
  } else if (a && d && difference(a, d) > settings.panelDifference) {
    Object.assign(look, { pattern: 'panel', topBase: d, topAccent: a })
  } else if (rows.filter(Boolean).length >= settings.minimumLimbVotes) look.pattern = 'plain'
  return look
}

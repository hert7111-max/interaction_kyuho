export type Point = { x: number; y: number }
export const TIP_INDICES = [4, 8, 12, 16, 20] as const

// Coordinates match object-fit: cover, optional mirror, and WebGL's bottom-up UVs.
export function cameraToSurface(point: Point, videoAspect: number, surfaceAspect: number, mirror: boolean): Point {
  const sx = Math.min(1, surfaceAspect / videoAspect)
  const sy = Math.min(1, videoAspect / surfaceAspect)
  return { x: ((mirror ? 1 - point.x : point.x) - .5) / sx + .5, y: (.5 - point.y) / sy + .5 }
}
export function coverScale(videoAspect: number, surfaceAspect: number): Point {
  return { x: Math.min(1, surfaceAspect / videoAspect), y: Math.min(1, videoAspect / surfaceAspect) }
}
export function smoothPoint(previous: Point, next: Point, dt: number): Point {
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y)
  const alpha = 1 - Math.exp(-Math.min(.1, dt) * (18 + distance * 120))
  return { x: previous.x + (next.x - previous.x) * alpha, y: previous.y + (next.y - previous.y) * alpha }
}

export const ENGLISH_WORDS = ['gravity', 'wonder', 'bloom', 'letter', 'orange', 'cloud', 'mellow', 'little', 'planet', 'dream', 'ripple', 'soft', 'hello', 'paper', 'float', 'blue', 'slow', 'rain', 'moon', 'fall']
export const KOREAN_WORDS = ['하늘', '바람', '구름', '나무', '별빛', '마음', '우주', '여름', '물결', '노을', '산책', '봄날', '초록', '달빛', '바다', '고요', '소리', '새벽', '햇살', '구슬']
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ']
const VOWELS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ']
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ']
const COMPOUNDS: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ', 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' }
export function decompose(text: string): string {
  return [...text.toLowerCase().normalize('NFC')].map(char => {
    const code = char.charCodeAt(0) - 0xac00
    const raw = code >= 0 && code <= 11171 ? INITIALS[Math.floor(code / 588)]! + VOWELS[Math.floor(code % 588 / 28)]! + FINALS[code % 28]! : char
    return [...raw].map(c => COMPOUNDS[c] || c).join('')
  }).join('')
}
export function inputProgress(word: string, value: string) {
  const target = decompose(word), typed = decompose(value)
  return { valid: target.startsWith(typed), complete: target === typed, count: typed.length, total: target.length }
}
export type Body = { char: string; x: number; y: number; vx: number; vy: number; angle: number; spin: number; size: number; color: string; settled: number; hit: boolean }
export const GRAVITY = 690
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export function stepBody(body: Body, dt: number, width: number, floor: number) {
  body.vy += GRAVITY * dt
  body.x += body.vx * dt; body.y += body.vy * dt; body.angle += body.spin * dt
  const radius = body.size * .43
  if (body.x < radius || body.x > width - radius) { body.x = clamp(body.x, radius, width - radius); body.vx *= -.55; body.spin *= -.6 }
  if (body.y + radius >= floor) {
    body.y = floor - radius
    if (Math.abs(body.vy) > 85) { body.vy *= -.28; body.vx *= .7; body.spin *= .6 }
    else { body.vy = 0; body.vx *= Math.exp(-dt * 8); body.spin *= Math.exp(-dt * 8); body.settled += dt }
  }
}
export function hitsPerson(body: Body, x: number, floor: number) {
  if (body.settled > 0 || body.y > floor - 12) return false
  const r = body.size * .31
  // Head and torso capsules leave the empty area around the limbs clear.
  const head = Math.hypot(body.x - x, body.y - (floor - 79)) < r + 13
  const torso = Math.hypot(body.x - x, body.y - clamp(body.y, floor - 63, floor - 26)) < r + 12
  return head || torso
}

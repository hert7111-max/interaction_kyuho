import './style.css'

// The reference face is drawn in independent SVG layers so eyes, muzzle,
// ears, and the head can follow the same point at different depths.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="scene" id="scene">
  <header class="header">
    <a class="wordmark" href="./" aria-label="느릿, 처음으로">느릿<span>∙</span></a>
    <span class="edition">A LITTLE EYE CONTACT</span>
    <button id="reset" class="reset" type="button" aria-label="정면 바라보기"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7M4 4v6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>다시 정면</span></button>
  </header>
  <section class="portrait" aria-label="포인터를 따라 바라보는 야도란">
    <div class="orb-wrap" id="orb" tabindex="0" role="button" aria-label="야도란에게 윙크 부탁하기. 방향키로 시선을 옮기고 스페이스 또는 엔터로 윙크하고 입을 닫았다 열어요.">
      <div class="aura" aria-hidden="true"></div>
      <svg class="character" viewBox="0 0 600 600" aria-hidden="true">
        <defs>
          <radialGradient id="glass" cx="31%" cy="23%" r="85%"><stop stop-color="#eed8e7" stop-opacity=".16"/><stop offset=".5" stop-color="#ba7194" stop-opacity=".06"/><stop offset=".85" stop-color="#784b70" stop-opacity=".1"/><stop offset="1" stop-color="#e6adc9" stop-opacity=".26"/></radialGradient>
          <radialGradient id="pink" gradientUnits="userSpaceOnUse" cx="216" cy="238" r="330" fx="190" fy="205"><stop stop-color="#ffd1de"/><stop offset=".28" stop-color="#f5adc5"/><stop offset=".55" stop-color="#df89aa"/><stop offset=".79" stop-color="#ba648d"/><stop offset="1" stop-color="#874466"/></radialGradient>
          <radialGradient id="ear" cx="31%" cy="24%" r="85%"><stop stop-color="#ffced9"/><stop offset=".45" stop-color="#ed9bb7"/><stop offset=".78" stop-color="#c57898"/><stop offset="1" stop-color="#965172"/></radialGradient>
          <radialGradient id="ear-inset" cx="65%" cy="70%" r="80%"><stop stop-color="#efacc1"/><stop offset=".6" stop-color="#c37496"/><stop offset="1" stop-color="#a0597d"/></radialGradient>
          <radialGradient id="cream" gradientUnits="userSpaceOnUse" cx="248" cy="311" r="205" gradientTransform="translate(0 117) scale(1 .63)"><stop stop-color="#ffffed"/><stop offset=".33" stop-color="#f8f4d6"/><stop offset=".65" stop-color="#e6deaf"/><stop offset=".88" stop-color="#c4b985"/><stop offset="1" stop-color="#a99b6e"/></radialGradient>
          <linearGradient id="chin" x1=".15" y1="0" x2=".65" y2="1"><stop stop-color="#fff5ce"/><stop offset=".5" stop-color="#e0d2a3"/><stop offset=".85" stop-color="#b6a17b"/><stop offset="1" stop-color="#9e896a"/></linearGradient>
          <radialGradient id="mouth" cx="51%" cy="80%" r="85%"><stop stop-color="#af3b60"/><stop offset=".55" stop-color="#842c48"/><stop offset="1" stop-color="#3c2032"/></radialGradient>
          <radialGradient id="tongue" cx="42%" cy="20%" r="90%"><stop stop-color="#ff9fba"/><stop offset=".55" stop-color="#e97c9f"/><stop offset="1" stop-color="#be547a"/></radialGradient>
          <radialGradient id="eye-white" cx="31%" cy="24%" r="90%"><stop stop-color="#fffffc"/><stop offset=".6" stop-color="#fafaf0"/><stop offset="1" stop-color="#d6d5c5"/></radialGradient>
          <radialGradient id="cheek-light"><stop stop-color="#ffd5e0" stop-opacity=".38"/><stop offset="1" stop-color="#ffd5e0" stop-opacity="0"/></radialGradient>
          <radialGradient id="head-highlight"><stop stop-color="#fff0f5" stop-opacity=".48"/><stop offset="1" stop-color="#fff0f5" stop-opacity="0"/></radialGradient>
          <radialGradient id="soft-shadow"><stop stop-color="#71354e" stop-opacity=".55"/><stop offset="1" stop-color="#71354e" stop-opacity="0"/></radialGradient>
          <filter id="muzzle-depth" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="1" dy="8" stdDeviation="7" flood-color="#74374e" flood-opacity=".32"/></filter>
          <linearGradient id="rim" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffe2ef" stop-opacity=".75"/><stop offset=".25" stop-color="#f7b6d6" stop-opacity=".09"/><stop offset=".6" stop-color="#ec9cc9" stop-opacity=".12"/><stop offset="1" stop-color="#fac6e2" stop-opacity=".5"/></linearGradient>
          <radialGradient id="reflection"><stop stop-color="#fff4fb" stop-opacity=".45"/><stop offset="1" stop-color="#fff4fb" stop-opacity="0"/></radialGradient>
          <clipPath id="sphere-clip"><circle cx="300" cy="300" r="267"/></clipPath>
          <clipPath id="mouth-clip"><path d="M155 359Q300 339 447 359C428 412 377 451 302 451C226 450 175 410 155 359Z"/></clipPath>
        </defs>
        <circle cx="300" cy="300" r="268" fill="#21161f"/>
        <circle cx="300" cy="300" r="267" fill="url(#glass)"/>
        <g clip-path="url(#sphere-clip)">
          <g id="head">
            <g class="ears" stroke="#b57694" stroke-width="1.8">
              <ellipse cx="145" cy="190" rx="52" ry="54" transform="rotate(-30 145 190)" fill="url(#ear)"/>
              <ellipse cx="455" cy="190" rx="52" ry="54" transform="rotate(30 455 190)" fill="url(#ear)"/>
              <ellipse cx="145" cy="193" rx="28" ry="30" fill="url(#ear-inset)" stroke="none"/>
              <ellipse cx="455" cy="193" rx="28" ry="30" fill="url(#ear-inset)" stroke="none"/>
              <path d="M141 211C112 201 126 169 142 172C157 170 164 187 154 199M459 211C488 201 474 169 458 172C443 170 436 187 446 199" fill="none" stroke="#a95f81" stroke-width="2.8" stroke-linecap="round"/>
              <path d="M112 172Q122 153 144 151M435 152Q455 145 474 162" fill="none" stroke="#ffe0e6" stroke-width="4" stroke-linecap="round" opacity=".44"/>
            </g>
            <path d="M111 312C112 223 169 164 295 163C418 160 483 219 490 309C503 350 512 393 493 436C466 505 390 541 300 543C207 541 131 505 105 439C86 394 98 348 111 312Z" fill="url(#pink)" stroke="#ad698a" stroke-width="1.5"/>
            <ellipse cx="215" cy="211" rx="107" ry="55" transform="rotate(-18 215 211)" fill="url(#head-highlight)"/>
            <ellipse cx="137" cy="350" rx="47" ry="100" fill="url(#cheek-light)" transform="rotate(10 137 350)"/>
            <ellipse cx="458" cy="365" rx="42" ry="89" fill="url(#cheek-light)" opacity=".32"/>
            <ellipse cx="313" cy="462" rx="158" ry="54" fill="url(#soft-shadow)"/>
            <path d="M118 330Q100 391 121 430" fill="none" stroke="#ffd3df" stroke-width="5" stroke-linecap="round" opacity=".19"/>
            <g id="features">
              <g transform="translate(216 282) rotate(13)">
                <g id="left-eye"><ellipse rx="36" ry="49" fill="url(#eye-white)" stroke="#90717b" stroke-width="2.1"/><ellipse cx="-9" cy="-12" rx="12" ry="24" fill="#fff" opacity=".7"/><g id="left-pupil"><ellipse rx="4.4" ry="8" fill="#39313e"/><circle cx="-1.2" cy="-2.7" r="1.4" fill="#fff"/></g></g>
                <path id="left-closed" d="M-27 6Q-3-12 24 2" fill="none" stroke="#754457" stroke-width="4" stroke-linecap="round" opacity="0"/>
              </g>
              <g transform="translate(387 282) rotate(-13)">
                <g id="right-eye"><ellipse rx="36" ry="49" fill="url(#eye-white)" stroke="#90717b" stroke-width="2.1"/><ellipse cx="-9" cy="-12" rx="12" ry="24" fill="#fff" opacity=".7"/><g id="right-pupil"><ellipse rx="4.4" ry="8" fill="#39313e"/><circle cx="-1.2" cy="-2.7" r="1.4" fill="#fff"/></g></g>
                <path id="right-closed" d="M-24 2Q3-12 27 6" fill="none" stroke="#754457" stroke-width="4" stroke-linecap="round" opacity="0"/>
              </g>
              <g id="muzzle">
                <ellipse cx="304" cy="391" rx="180" ry="58" fill="url(#soft-shadow)"/>
                <g id="lower-jaw">
                  <path d="M138 350C140 323 217 309 297 312C382 310 455 322 466 349C480 386 407 473 304 477C203 475 126 389 138 350Z" fill="url(#chin)" stroke="#ac9776" stroke-width="1.8"/>
                  <path d="M155 359Q300 339 447 359C428 412 377 451 302 451C226 450 175 410 155 359Z" fill="url(#mouth)" stroke="#81505b" stroke-width="2"/>
                  <g clip-path="url(#mouth-clip)">
                    <ellipse cx="305" cy="447" rx="94" ry="42" fill="url(#tongue)"/>
                    <path d="M222 433Q266 406 309 414" fill="none" stroke="#ffb7ca" stroke-width="3" stroke-linecap="round" opacity=".25"/>
                    <path d="M183 364L197 395Q204 403 215 367M392 366L405 393Q412 401 423 366" fill="#fffcec" stroke="#a59b83" stroke-width="1.6" stroke-linejoin="round"/>
                  </g>
                  <path d="M171 399Q211 457 278 464" fill="none" stroke="#fff0cb" stroke-width="3" stroke-linecap="round" opacity=".34"/>
                </g>
                <g filter="url(#muzzle-depth)">
                  <path d="M128 340C139 315 187 311 233 291Q295 265 349 290C398 308 455 310 470 338C496 377 426 387 375 376C328 366 279 367 231 379C180 391 109 376 128 340Z" fill="url(#cream)" stroke="#b3a87f" stroke-width="1.8"/>
                  <ellipse cx="240" cy="314" rx="84" ry="25" fill="url(#head-highlight)" opacity=".65"/>
                  <path d="M149 338C176 320 204 320 237 303" fill="none" stroke="#ffffed" stroke-width="4" stroke-linecap="round" opacity=".45"/>
                  <path d="m273 321 6 8m47-9-6 8" stroke="#8d8265" stroke-width="3.7" stroke-linecap="round"/>
                </g>
                <path id="mouth-seam" d="M151 366C188 388 235 372 270 370Q302 365 336 370C374 375 424 387 450 366" fill="none" stroke="#967950" stroke-width="2.2" stroke-linecap="round" opacity="0"/>
              </g>
            </g>
          </g>
          <ellipse cx="180" cy="130" rx="90" ry="45" fill="url(#reflection)" transform="rotate(-37 180 130)"/>
          <path d="M74 248C87 167 137 103 205 78" fill="none" stroke="#fff2fc" stroke-width="5" stroke-linecap="round" opacity=".33"/>
          <path d="M83 219C91 189 103 168 119 146" fill="none" stroke="#fff5fc" stroke-width="2" stroke-linecap="round" opacity=".55"/>
          <path d="M431 513Q494 472 518 418" fill="none" stroke="#ffbddf" stroke-width="3" stroke-linecap="round" opacity=".2"/>
        </g>
        <circle cx="300" cy="300" r="268" fill="none" stroke="url(#rim)" stroke-width="2"/>
        <circle cx="300" cy="300" r="262" fill="none" stroke="#f8c4dc" stroke-opacity=".06"/>
      </svg>
      <span class="spark spark-one" aria-hidden="true">✦</span><span class="spark spark-two" aria-hidden="true">✧</span>
    </div>
    <div class="orb-shadow" aria-hidden="true"></div>
    <div class="caption"><span class="character-name">SLOWBRO</span><span class="caption-line"></span><span id="mood">조금 느려도, 널 보고 있어.</span></div>
  </section>
  <footer class="footer">
    <span class="footer-note"><i></i>서두르지 않아도 괜찮아.</span>
    <div class="instructions"><span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 3 10 7-5 1-2 5-3-13Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>움직이면 눈맞춤</span><span class="separator"></span><button id="wink" type="button"><span class="wink-icon">◡</span>클릭하면 찡긋 · 냠</button></div>
    <span class="footer-edition">TAKE IT SLOW. ↗</span>
  </footer>
  <span class="sr-only" id="announcement" role="status" aria-live="polite"></span>
</main>`

const orb = document.querySelector<HTMLDivElement>('#orb')!
const head = document.querySelector<SVGGElement>('#head')!
const features = document.querySelector<SVGGElement>('#features')!
const muzzle = document.querySelector<SVGGElement>('#muzzle')!
const lowerJaw = document.querySelector<SVGGElement>('#lower-jaw')!
const mouthSeam = document.querySelector<SVGPathElement>('#mouth-seam')!
const mood = document.querySelector('#mood')!
const eyes = ['left', 'right'].map(side => ({ eye: document.querySelector<SVGGElement>(`#${side}-eye`)!, pupil: document.querySelector<SVGGElement>(`#${side}-pupil`)!, closed: document.querySelector<SVGPathElement>(`#${side}-closed`)! }))
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const WINK_DURATION = 920
let target = { x: 0, y: 0 }, gaze = { x: 0, y: 0 }, pupils = { x: 0, y: 0 }
let winkAt = -Infinity, winkSide = 1, winkCount = 0
let blinkAt = -Infinity, nextBlink = performance.now() + 4200
let lockUntil = 0, returnAt = Infinity
let pendingTarget = { x: 0, y: 0 }
let lastFrame = performance.now()
let leftOpen = 1, rightOpen = 1, mouthOpen = 1
let touching = false
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

function pointToGaze(x: number, y: number) {
  const rect = orb.getBoundingClientRect()
  const dx = (x - rect.left - rect.width / 2) / Math.max(1, rect.width * .82)
  const dy = (y - rect.top - rect.height / 2) / Math.max(1, rect.height * .82)
  // A circular limit keeps the pupils safely inside the eye whites at corners.
  const distance = Math.hypot(dx, dy)
  const scale = distance > 1 ? 1 / distance : 1
  return { x: dx * scale, y: dy * scale }
}
function lookAt(x: number, y: number, now = performance.now()) {
  pendingTarget = pointToGaze(x, y)
  if (now >= lockUntil) target = { ...pendingTarget }
  returnAt = Infinity
}
function wink(now = performance.now()) {
  winkAt = now
  winkSide = target.x < -.12 ? 0 : 1
  winkCount++
  lockUntil = now + 440
  // Do not let an automatic blink close the other eye during the wink.
  blinkAt = -Infinity; nextBlink = now + 3500 + Math.random() * 2500
  mood.textContent = '너한테만, 찡긋.'
  orb.classList.add('is-winking')
  document.querySelector('#announcement')!.textContent = '야도란이 바라보며 윙크하고 입을 닫았다 열어요.'
}
function center() {
  target = { x: 0, y: 0 }; pendingTarget = { ...target }
  lockUntil = 0; returnAt = Infinity; touching = false
}
function eyelid(now: number, started: number, duration: number, hold: number) {
  const p = (now - started) / duration
  if (p < 0 || p >= 1) return 1
  if (p < .15) return 1 - Math.sin(p / .15 * Math.PI / 2) * .97
  if (p < hold) return .03
  const t = (p - hold) / (1 - hold)
  return .03 + .97 * (t * t * (3 - 2 * t))
}

window.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' && !touching) return
  lookAt(event.clientX, event.clientY)
})
window.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const element = event.target as Element | null
  if (element?.closest('button, a')) return
  if (event.pointerType === 'touch') { touching = true; event.preventDefault() }
  // A new click must override any previous wink's gaze lock.
  lockUntil = 0; lookAt(event.clientX, event.clientY); wink()
})
window.addEventListener('pointerup', event => {
  if (event.pointerType === 'touch') { touching = false; returnAt = performance.now() + 1900 }
})
window.addEventListener('pointercancel', () => { touching = false; center() })
document.documentElement.addEventListener('pointerleave', () => { if (!touching) returnAt = performance.now() + 550 })
window.addEventListener('blur', center)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) center()
  lastFrame = performance.now(); nextBlink = lastFrame + 4000
})
document.querySelector('#reset')!.addEventListener('click', () => { center(); winkAt = -Infinity; mood.textContent = '조금 느려도, 널 보고 있어.'; orb.classList.remove('is-winking') })
document.querySelector('#wink')!.addEventListener('click', () => wink())
orb.addEventListener('click', event => { if (event.detail === 0) wink() })
orb.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') center()
  else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) wink()
  else {
    const step = .25
    if (event.key === 'ArrowLeft') pendingTarget.x -= step
    if (event.key === 'ArrowRight') pendingTarget.x += step
    if (event.key === 'ArrowUp') pendingTarget.y -= step
    if (event.key === 'ArrowDown') pendingTarget.y += step
    const length = Math.hypot(pendingTarget.x, pendingTarget.y)
    if (length > 1) { pendingTarget.x /= length; pendingTarget.y /= length }
    target = { ...pendingTarget }; returnAt = Infinity; lockUntil = 0
  }
})

function mouthOpenness(now: number) {
  const p = (now - winkAt) / WINK_DURATION
  if (p < 0 || p >= 1) return 1
  const smooth = (t: number) => t * t * (3 - 2 * t)
  if (p < .25) return 1 - .98 * smooth(p / .25)
  if (p < .44) return .02
  return .02 + .98 * smooth((p - .44) / .56)
}

function animate(now: number) {
  const dt = clamp((now - lastFrame) / 1000, 0, .05); lastFrame = now
  if (now >= returnAt) center()
  if (now >= lockUntil) target = { ...pendingTarget }
  const headRate = 1 - Math.exp(-dt * (reducedMotion.matches ? 22 : 7.5))
  const eyeRate = 1 - Math.exp(-dt * 16)
  gaze.x += (target.x - gaze.x) * headRate; gaze.y += (target.y - gaze.y) * headRate
  pupils.x += (target.x - pupils.x) * eyeRate; pupils.y += (target.y - pupils.y) * eyeRate
  const winkProgress = (now - winkAt) / WINK_DURATION
  const winkActive = winkProgress >= 0 && winkProgress < 1
  if (!winkActive && now >= nextBlink) { blinkAt = now; nextBlink = now + 4000 + Math.random() * 3000 }
  const blink = eyelid(now, blinkAt, 190, .26)
  const winkOpen = eyelid(now, winkAt, WINK_DURATION, .55)
  leftOpen = winkActive && winkSide === 0 ? winkOpen : blink
  rightOpen = winkActive && winkSide === 1 ? winkOpen : blink
  // Small layered translations read as a rounded face turning inside the orb.
  head.setAttribute('transform', `translate(${gaze.x * 9} ${gaze.y * 6}) rotate(${gaze.x * 2.4} 300 330)`)
  features.setAttribute('transform', `translate(${gaze.x * 16} ${gaze.y * 11})`)
  const smile = winkActive ? Math.sin(clamp(winkProgress * 1.6, 0, 1) * Math.PI) : 0
  muzzle.setAttribute('transform', `translate(${gaze.x * 3} ${gaze.y * 2 - smile * 2})`)
  mouthOpen = mouthOpenness(now)
  // Raise the jaw toward the upper lip, keeping the snout solid.
  lowerJaw.setAttribute('transform', `translate(0 360) scale(1 ${mouthOpen}) translate(0 -360)`)
  mouthSeam.setAttribute('opacity', String(clamp((.3 - mouthOpen) / .28, 0, 1)))
  for (let i = 0; i < eyes.length; i++) {
    const eye = eyes[i]!, open = i === 0 ? leftOpen : rightOpen
    eye.eye.setAttribute('transform', `scale(1 ${open})`)
    eye.eye.setAttribute('opacity', open < .08 ? '0' : '1')
    eye.closed.setAttribute('opacity', String(clamp((.25 - open) / .17, 0, 1)))
    // Counter-rotate the gaze offset to match each tilted eye's local axes.
    const angle = (i === 0 ? -13 : 13) * Math.PI / 180
    const px = pupils.x * 15, py = pupils.y * 25
    eye.pupil.setAttribute('transform', `translate(${px * Math.cos(angle) - py * Math.sin(angle)} ${px * Math.sin(angle) + py * Math.cos(angle)})`)
  }
  orb.style.setProperty('--look-x', String(gaze.x))
  orb.style.setProperty('--look-y', String(gaze.y))
  if (!winkActive && orb.classList.contains('is-winking')) {
    orb.classList.remove('is-winking'); mood.textContent = '조금 느려도, 널 보고 있어.'
  }
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
Object.defineProperty(window, '__slowbro', { get: () => ({ target: { ...target }, gaze: { ...gaze }, pupils: { ...pupils }, leftOpen, rightOpen, mouthOpen, winkCount, winkSide, touching, locked: performance.now() < lockUntil }) })

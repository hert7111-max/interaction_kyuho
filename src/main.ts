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
    <div class="orb-wrap" id="orb" tabindex="0" role="button" aria-label="야도란에게 윙크 부탁하기. 방향키로 시선을 옮기고 스페이스 또는 엔터로 윙크하세요.">
      <div class="aura" aria-hidden="true"></div>
      <svg class="character" viewBox="0 0 600 600" aria-hidden="true">
        <defs>
          <radialGradient id="glass" cx="31%" cy="23%" r="85%"><stop stop-color="#eed8e7" stop-opacity=".16"/><stop offset=".5" stop-color="#ba7194" stop-opacity=".06"/><stop offset=".85" stop-color="#784b70" stop-opacity=".1"/><stop offset="1" stop-color="#e6adc9" stop-opacity=".26"/></radialGradient>
          <radialGradient id="pink" cx="33%" cy="21%" r="85%"><stop stop-color="#ffc3d4"/><stop offset=".34" stop-color="#f0a0ba"/><stop offset=".69" stop-color="#dc799f"/><stop offset="1" stop-color="#a94e7a"/></radialGradient>
          <radialGradient id="ear" cx="35%" cy="25%" r="80%"><stop stop-color="#ffc2d0"/><stop offset=".6" stop-color="#e894ae"/><stop offset="1" stop-color="#b75a87"/></radialGradient>
          <linearGradient id="cream" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="#fffee9"/><stop offset=".5" stop-color="#f5f1cd"/><stop offset="1" stop-color="#d6cc9d"/></linearGradient>
          <linearGradient id="chin" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8f0c8"/><stop offset="1" stop-color="#d6c393"/></linearGradient>
          <linearGradient id="mouth" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#542c49"/><stop offset="1" stop-color="#9f4967"/></linearGradient>
          <linearGradient id="tongue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fa9bb7"/><stop offset="1" stop-color="#da759c"/></linearGradient>
          <linearGradient id="rim" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffe2ef" stop-opacity=".75"/><stop offset=".25" stop-color="#f7b6d6" stop-opacity=".09"/><stop offset=".6" stop-color="#ec9cc9" stop-opacity=".12"/><stop offset="1" stop-color="#fac6e2" stop-opacity=".5"/></linearGradient>
          <radialGradient id="reflection"><stop stop-color="#fff4fb" stop-opacity=".45"/><stop offset="1" stop-color="#fff4fb" stop-opacity="0"/></radialGradient>
          <clipPath id="sphere-clip"><circle cx="300" cy="300" r="267"/></clipPath>
          <clipPath id="mouth-clip"><path d="M184 361Q300 339 423 359Q408 444 307 448Q218 446 184 361Z"/></clipPath>
        </defs>
        <circle cx="300" cy="300" r="268" fill="#21161f"/>
        <circle cx="300" cy="300" r="267" fill="url(#glass)"/>
        <g clip-path="url(#sphere-clip)">
          <g id="head">
            <g class="ears" stroke="#a95d80" stroke-width="3">
              <ellipse cx="174" cy="177" rx="49" ry="55" transform="rotate(-30 174 177)" fill="url(#ear)"/>
              <ellipse cx="426" cy="177" rx="49" ry="55" transform="rotate(30 426 177)" fill="url(#ear)"/>
              <path d="M169 196C141 185 153 154 169 157C185 155 190 173 182 183M431 196C459 185 447 154 431 157C415 155 410 173 418 183" fill="none" stroke-linecap="round"/>
            </g>
            <path d="M157 303C160 219 202 160 297 160C395 158 443 218 448 310L460 401C473 487 398 548 300 551C200 551 126 492 140 407Z" fill="url(#pink)" stroke="#ad5c81" stroke-width="2.5"/>
            <ellipse cx="237" cy="201" rx="56" ry="19" transform="rotate(-21 237 201)" fill="#ffe5ec" opacity=".23"/>
            <path d="M172 308Q159 370 167 398" fill="none" stroke="#ffd3df" stroke-width="8" stroke-linecap="round" opacity=".14"/>
            <g id="features">
              <g transform="translate(230 284) rotate(10)">
                <g id="left-eye"><ellipse rx="32" ry="53" fill="#fffef5" stroke="#705360" stroke-width="3"/><ellipse cx="-9" cy="-12" rx="11" ry="25" fill="#fff" opacity=".7"/><g id="left-pupil"><ellipse rx="4.4" ry="8" fill="#39313e"/><circle cx="-1.2" cy="-2.7" r="1.4" fill="#fff"/></g></g>
                <path id="left-closed" d="M-27 6Q-3-12 24 2" fill="none" stroke="#754457" stroke-width="4" stroke-linecap="round" opacity="0"/>
              </g>
              <g transform="translate(371 284) rotate(-10)">
                <g id="right-eye"><ellipse rx="32" ry="53" fill="#fffef5" stroke="#705360" stroke-width="3"/><ellipse cx="-9" cy="-12" rx="11" ry="25" fill="#fff" opacity=".7"/><g id="right-pupil"><ellipse rx="4.4" ry="8" fill="#39313e"/><circle cx="-1.2" cy="-2.7" r="1.4" fill="#fff"/></g></g>
                <path id="right-closed" d="M-24 2Q3-12 27 6" fill="none" stroke="#754457" stroke-width="4" stroke-linecap="round" opacity="0"/>
              </g>
              <g id="muzzle">
                <path d="M169 351C171 321 226 311 294 313C366 310 425 323 438 348C451 380 398 466 307 471C224 472 164 401 169 351Z" fill="url(#chin)" stroke="#9d8b70" stroke-width="3"/>
                <path d="M184 361Q300 339 423 359Q408 444 307 448Q218 446 184 361Z" fill="url(#mouth)" stroke="#785866" stroke-width="2.5"/>
                <g clip-path="url(#mouth-clip)"><ellipse cx="309" cy="446" rx="78" ry="39" fill="url(#tongue)"/><path d="M209 357L220 382Q226 389 231 358M386 357L393 379Q399 388 406 359" fill="#fffdee" stroke="#8f8073" stroke-width="2" stroke-linejoin="round"/></g>
                <path d="M161 342C169 316 209 315 247 295Q292 274 336 293C373 308 421 310 438 339C463 375 400 380 362 372C328 365 282 365 245 374C201 383 150 371 161 342Z" fill="url(#cream)" stroke="#a99d80" stroke-width="3"/>
                <path d="M180 336C207 317 232 319 253 306" fill="none" stroke="#fffef3" stroke-width="6" stroke-linecap="round" opacity=".65"/>
                <path d="m274 327 5 7m43-8-5 7" stroke="#80745d" stroke-width="3.7" stroke-linecap="round"/>
                <ellipse id="left-blush" cx="188" cy="382" rx="18" ry="9" fill="#f3a1ad" opacity=".33"/><ellipse id="right-blush" cx="414" cy="382" rx="18" ry="9" fill="#f3a1ad" opacity=".33"/>
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
    <div class="instructions"><span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 3 10 7-5 1-2 5-3-13Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>움직이면 눈맞춤</span><span class="separator"></span><button id="wink" type="button"><span class="wink-icon">◡</span>클릭하면 윙크</button></div>
    <span class="footer-edition">TAKE IT SLOW. ↗</span>
  </footer>
  <span class="sr-only" id="announcement" role="status" aria-live="polite"></span>
</main>`

const orb = document.querySelector<HTMLDivElement>('#orb')!
const head = document.querySelector<SVGGElement>('#head')!
const features = document.querySelector<SVGGElement>('#features')!
const muzzle = document.querySelector<SVGGElement>('#muzzle')!
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
let leftOpen = 1, rightOpen = 1
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
  document.querySelector('#announcement')!.textContent = '야도란이 바라보며 윙크해요.'
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
  for (let i = 0; i < eyes.length; i++) {
    const eye = eyes[i]!, open = i === 0 ? leftOpen : rightOpen
    eye.eye.setAttribute('transform', `scale(1 ${open})`)
    eye.eye.setAttribute('opacity', open < .08 ? '0' : '1')
    eye.closed.setAttribute('opacity', String(clamp((.25 - open) / .17, 0, 1)))
    // Counter-rotate the gaze offset to match each tilted eye's local axes.
    const angle = (i === 0 ? -10 : 10) * Math.PI / 180
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
Object.defineProperty(window, '__slowbro', { get: () => ({ target: { ...target }, gaze: { ...gaze }, pupils: { ...pupils }, leftOpen, rightOpen, winkCount, winkSide, touching, locked: performance.now() < lockUntil }) })

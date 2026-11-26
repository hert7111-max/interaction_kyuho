import { CONFIG } from '../config.js'

export function setupHUD(stage) {
  const { colors, camera, layout, hud } = CONFIG
  const white = alpha => `color-mix(in srgb, ${colors.hud} ${alpha * 100}%, transparent)`
  const styles = {
    ink: colors.hud, backdrop: colors.backdrop, brightness: camera.brightness,
    'character-width': `${layout.characterWidth * 100}%`, 'video-layer': layout.videoLayer,
    'character-layer': layout.characterLayer, 'overlay-layer': layout.overlayLayer, 'hud-layer': layout.hudLayer,
    font: hud.font, 'button-width': hud.buttonWidth, 'button-padding': hud.buttonPadding,
    'button-tracking': hud.buttonTracking, 'text-size': hud.textSize, muted: white(hud.quietText),
    rule: white(hud.ruleOpacity), hover: white(hud.hoverOpacity), 'thin-line': hud.thinLine,
    corner: hud.cornerSize, 'breathe-ms': `${hud.breatheMs}ms`, 'min-opacity': hud.minButtonOpacity,
    'status-offset': hud.statusOffset, 'panel-top': hud.panelTop, 'panel-width': hud.panelWidth, edge: hud.edge, gap: hud.gap,
    'subject-label-bottom': CONFIG.build.subjectLabelBottom, 'subject-label-clearance': CONFIG.build.subjectLabelClearance,
    'rescan-bottom': CONFIG.build.rescanBottom, 'debug-bottom': CONFIG.gesture.debug.panelBottom,
    'state-line': CONFIG.motion.labelLine, 'state-gap': CONFIG.motion.labelGap,
  }
  for (const [key, value] of Object.entries(styles)) document.body.style.setProperty('--scan-' + key, value)
  const button = stage.querySelector('.scan-start')
  const panel = stage.querySelector('.scan-log')
  const log = stage.querySelector('.scan-steps')
  const title = stage.querySelector('.scan-log-title span')
  const progress = stage.querySelector('.scan-percentage')
  const track = stage.querySelector('.scan-progress')
  const status = stage.querySelector('.scan-status')
  status.textContent = CONFIG.scan.framingHint
  const subject = stage.querySelector('.scan-subject-label')
  const character = stage.querySelector('.scan-state')
  const characterLabel = character.firstElementChild
  const control = stage.querySelector('.scan-control')
  const diagnostics = stage.querySelector('.scan-debug')
  const steps = CONFIG.scan.logs.map(entry => {
    const item = document.createElement('li')
    item.textContent = entry.text
    log.append(item)
    return item
  })
  return {
    button,
    idle(message = '') {
      button.hidden = false
      button.disabled = false
      button.textContent = 'CLICK TO SCAN'
      panel.hidden = true
      subject.hidden = true
      character.hidden = true
      control.hidden = diagnostics.hidden = true
      status.textContent = message || CONFIG.scan.framingHint
    },
    loading() {
      button.disabled = true
      button.textContent = 'PREPARING...'
      status.textContent = ''
    },
    start() {
      button.hidden = true
      panel.hidden = false
      title.textContent = 'SCANNING'
      log.hidden = false
      status.textContent = CONFIG.scan.framingHint
      this.update(0)
    },
    update(ratio) {
      this.buildProgress(ratio)
      steps.forEach((item, i) => { item.hidden = ratio < CONFIG.scan.logs[i].at })
    },
    buildProgress(ratio) {
      const value = Math.floor(ratio * 100)
      progress.textContent = value + '%'
      track.setAttribute('aria-valuenow', String(value))
      track.firstElementChild.style.transform = `scaleX(${ratio})`
    },
    building() {
      title.textContent = 'BUILDING'
      log.hidden = true
      button.hidden = true
      status.textContent = ''
      this.buildProgress(0)
    },
    buildFailed() {
      title.textContent = 'COMPLETE'
      button.hidden = false
      button.disabled = false
      button.textContent = 'SCAN AGAIN'
      status.textContent = 'WebGL 화면을 열지 못했어요. 스캔 결과는 저장됐습니다.'
    },
    controlStatus(text) {
      control.hidden = !text
      if (control.textContent !== text) control.textContent = text
    },
    characterState({ state, x, y }) {
      const text = `STATE: ${state}`
      if (characterLabel.textContent !== text) characterLabel.textContent = text
      character.hidden = false
      character.style.transform = `translate3d(${x}px, ${y}px, 0)`
    },
    debug(state) {
      diagnostics.hidden = !state
      if (!state) return
      const number = value => value.toFixed(CONFIG.gesture.debug.digits)
      const rows = state.extensions
        ? Object.entries(state.extensions).map(([finger, value]) => `${finger.toUpperCase()}  ${number(value)}`) : []
      diagnostics.textContent = [`${state.gesture}  ENERGY ${number(state.energy)}`, ...rows].join('\n')
    },
    complete() {
      title.textContent = 'COMPLETE'
      this.buildProgress(1)
      subject.hidden = false
      button.hidden = false
      button.disabled = false
      button.textContent = 'SCAN AGAIN'
      status.textContent = ''
    },
  }
}

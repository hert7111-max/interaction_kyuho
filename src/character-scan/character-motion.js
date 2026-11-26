import { CONFIG } from '../config.js'
import { GESTURE } from '../gesture.js'

const settings = CONFIG.motion
const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => value * value * (3 - 2 * value)

function settleAxis(current, target, amount) {
  return Math.abs(current - target) < settings.settled ? target : current + (target - current) * amount
}

export class CharacterMotion {
  speed = 0
  runEnergy = 0
  distance = 0
  cycle = 0
  breathing = 0
  jumpStart = null
  landingAt = null
  brake = null
  last = null
  lastInput = GESTURE.IDLE
  followX = 0
  followY = 0

  update(now, input) {
    const dt = Math.max(0, Math.min(settings.maximumDeltaMs, now - (this.last ?? now)))
    this.last = now
    const amount = 1 - Math.exp(-dt / settings.settlingMs)
    const previousSpeed = this.speed

    // Keep the last measured stride while the detector confirms a gesture change.
    if (input.gesture !== GESTURE.RUN) this.runEnergy = 0
    else if (input.energy >= CONFIG.gesture.exitEnergy) this.runEnergy = clamp(input.energy)
    if (input.gesture === GESTURE.STOP && this.lastInput !== GESTURE.STOP && this.speed > 0) {
      this.brake = { at: now, speed: this.speed }
    }
    this.lastInput = input.gesture
    if (input.jump && this.jumpStart === null) {
      this.jumpStart = now
      this.landingAt = null
    }
    if (this.jumpStart !== null && now - this.jumpStart >= settings.jumpDurationMs) {
      this.landingAt = this.jumpStart + settings.jumpDurationMs
      this.jumpStart = null
    }
    const jumpProgress = this.jumpStart === null ? 0 : clamp((now - this.jumpStart) / settings.jumpDurationMs)
    const air = 4 * jumpProgress * (1 - jumpProgress)
    const landingProgress = this.landingAt === null ? 1 : clamp((now - this.landingAt) / settings.landingDurationMs)
    const landing = landingProgress < settings.landingPeak
      ? smooth(landingProgress / settings.landingPeak)
      : 1 - smooth((landingProgress - settings.landingPeak) / (1 - settings.landingPeak))
    if (landingProgress >= 1) this.landingAt = null
    const jumping = this.jumpStart !== null || this.landingAt !== null

    let lurch = 0
    if (this.brake) {
      const stop = this.brake
      const t = clamp((now - stop.at) / settings.stopDurationMs)
      this.speed = stop.speed * (1 - smooth(t))
      lurch = Math.sin(Math.PI * t) * settings.stopForwardLean * clamp(stop.speed / settings.maxSpeed)
      if (t === 1) this.brake = null
    } else if (input.gesture === GESTURE.STOP) {
      this.speed = 0
    } else {
      const desired = jumping ? 0 : settings.maxSpeed * this.runEnergy
      this.speed += (desired - this.speed) * amount
      if (this.speed < settings.settled) this.speed = 0
    }

    const travel = (this.speed + previousSpeed) / 2 * dt / 1000
    this.distance += travel
    this.cycle += travel * settings.strideHz * 2 * Math.PI
    const stopping = this.brake !== null || input.gesture === GESTURE.STOP
    const target = jumping || stopping || input.gesture === GESTURE.RUN ? null : input.hand
    const followAmount = 1 - Math.exp(-dt / settings.follow.settleMs)
    const previousX = this.followX, previousY = this.followY
    this.followX = settleAxis(this.followX, target?.x ?? 0, followAmount)
    this.followY = settleAxis(this.followY, target?.y ?? 0, followAmount)
    const following = Math.max(Math.abs(this.followX), Math.abs(this.followY)) > settings.settled
    const crouch = Math.max(0, -this.followY) * settings.follow.crouch
    const raised = Math.max(0, this.followY)
    this.breathing = jumping || stopping ? 0 : this.breathing + dt / 1000 * settings.breathingHz * 2 * Math.PI
    const gait = jumping ? 0 : clamp(this.speed / settings.maxSpeed)
    const swing = Math.sin(this.cycle) * gait
    const breath = (1 - gait) * (1 - Math.cos(this.breathing)) * settings.breathingHeight / 2
    const state = jumping ? GESTURE.JUMP
      : stopping ? GESTURE.STOP
        : input.gesture === GESTURE.RUN ? GESTURE.RUN
          : following ? GESTURE.FOLLOW : GESTURE.IDLE

    return {
      state, distance: this.distance,
      height: air * settings.jumpHeight + Math.abs(swing) * settings.bob + breath,
      lean: gait * settings.lean + lurch,
      side: this.followX * settings.follow.travel,
      turn: this.followX * settings.follow.turn,
      tilt: -this.followX * settings.follow.tilt,
      handLift: raised * settings.follow.lift,
      handSpread: raised * settings.follow.spread,
      handMoving: this.followX !== previousX || this.followY !== previousY,
      arm: swing * settings.armSwing, leg: swing * settings.legSwing,
      jumpArm: air * settings.jumpArmLift, jumpKnee: air * settings.jumpKnee,
      scaleY: 1 - landing * settings.landingSquash - crouch,
      scaleXZ: 1 + landing * settings.landingSpread + crouch / 2,
      shadowScale: 1 - air * (1 - settings.jumpShadowScale),
    }
  }
}

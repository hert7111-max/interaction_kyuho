import { CONFIG } from '../config.js'

export const PHASE = Object.freeze({ IDLE: 'IDLE', SCANNING: 'SCANNING', BUILDING: 'BUILDING', CONTROL: 'CONTROL' })

export function createScanMachine() {
  return {
    phase: PHASE.IDLE,
    startedAt: null,
    buildingAt: null,
    pausedAt: null,
    scanResult: null,
    start(now) {
      this.phase = PHASE.SCANNING
      this.startedAt = now
      this.buildingAt = null
      this.pausedAt = null
      this.scanResult = null
    },
    progress(now) {
      if (this.phase === PHASE.BUILDING || this.phase === PHASE.CONTROL) return 1
      if (this.startedAt === null) return 0
      return Math.min(1, Math.max(0, (now - this.startedAt) / CONFIG.scan.durationMs))
    },
    finish(now, scanResult) {
      if (this.phase !== PHASE.SCANNING || this.progress(now) < 1 || !scanResult) return false
      this.phase = PHASE.BUILDING
      this.buildingAt = now
      this.scanResult = scanResult
      return true
    },
    buildProgress(now) {
      if (this.phase === PHASE.CONTROL) return 1
      if (this.buildingAt === null) return 0
      return Math.min(1, Math.max(0, ((this.pausedAt ?? now) - this.buildingAt) / CONFIG.build.durationMs))
    },
    completeBuild(now) {
      if (this.phase !== PHASE.BUILDING || this.buildProgress(now) < 1) return false
      this.phase = PHASE.CONTROL
      return true
    },
    pauseBuild(now) {
      if (this.phase === PHASE.BUILDING && this.pausedAt === null) this.pausedAt = now
    },
    resumeBuild(now) {
      if (this.pausedAt === null) return
      this.buildingAt += now - this.pausedAt
      this.pausedAt = null
    },
    reset() {
      this.phase = PHASE.IDLE
      this.startedAt = null
      this.buildingAt = null
      this.pausedAt = null
      this.scanResult = null
    },
  }
}

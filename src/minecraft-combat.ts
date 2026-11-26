export const equipment = [
  { id: 'sword', name: '청록 검', duration: 380, impact: 115, damage: 22 },
  { id: 'bow', name: '목재 활', duration: 480, impact: 295, release: 205, damage: 18 },
  { id: 'hammer', name: '오함마', duration: 630, impact: 310, damage: 34 },
] as const

export type Weapon = typeof equipment[number]
export type Direction = { x: number; y: number }
export type Strike = { weapon: Weapon; start: number; direction: Direction }

export const maxHp = 100

export class Combat {
  hp = maxHp
  get dead() { return this.hp === 0 }
  weapon: Weapon = equipment[0]
  strike: Strike | null = null
  private queued: Direction | null = null
  private resolved = false
  private flashAt = -Infinity

  select(weapon: Weapon) {
    if (weapon !== this.weapon) {
      this.strike = null
      this.queued = null
      this.weapon = weapon
    }
  }

  attack(now: number, direction: Direction) {
    if (this.dead) return
    if (this.strike) {
      this.queued = direction
      return
    }
    this.strike = { weapon: this.weapon, start: now, direction }
    this.resolved = false
  }

  update(now: number, onTarget: boolean) {
    const strike = this.strike
    if (!strike) return false
    let defeated = false
    const age = now - strike.start
    if (!this.resolved && age >= strike.weapon.impact) {
      this.resolved = true
      if (onTarget && !this.dead) {
        this.hp = Math.max(0, this.hp - strike.weapon.damage)
        defeated = this.dead
        this.flashAt = now
        if (defeated) this.queued = null
      }
    }
    if (age >= strike.weapon.duration) {
      this.strike = null
      const next = this.queued
      this.queued = null
      if (next) this.attack(now, next)
    }
    return defeated
  }

  flash(now: number) {
    const age = now - this.flashAt
    if (age >= 235) return 0
    return age < 80 ? .88 : .66 * (1 - (age - 80) / 155) ** 2
  }

  cancelAttack() {
    this.strike = this.queued = null
    this.flashAt = -Infinity
  }

  reset() {
    this.cancelAttack()
    this.hp = maxHp
  }
}

export type PersonMask = {
  pixels: Uint8Array
  width: number
  height: number
  timestamp: number
}

export const maskThreshold = .60
export function centerOnPerson(mask: PersonMask | null, now: number) {
  if (!mask || now - mask.timestamp > 500) return false
  const left = Math.floor((mask.width - 1) / 2)
  const right = Math.ceil((mask.width - 1) / 2)
  const top = Math.floor((mask.height - 1) / 2) * mask.width
  const bottom = Math.ceil((mask.height - 1) / 2) * mask.width
  // Linear filtering at UV (0.5, 0.5), which stays fixed by mirror and centered cover.
  const confidence = (mask.pixels[top + left]! + mask.pixels[top + right]! +
    mask.pixels[bottom + left]! + mask.pixels[bottom + right]!) / (4 * 255)
  return confidence >= maskThreshold
}

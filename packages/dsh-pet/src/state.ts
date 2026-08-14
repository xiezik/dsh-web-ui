/**
 * Pet state machine — pure, clock-injected. Maps the pet's working-phase
 * vocabulary (the service derives it from core session events) onto the
 * pet animation contract (Codex 9-state rows + tool-specific bust rows),
 * plus the session lifecycle transitions the web UI exposes (turn end
 * celebration, no-session idle).
 *
 * The machine is deliberately dumb: it holds the last input phase, the
 * animation decision, and a one-shot "celebration" window after `done` so the
 * pet visibly jumps before settling back to idle. Everything here is a pure
 * function of (input, nowMs); persistence and RPC live in the service.
 * @module @linxin666/dsh-pet/state
 */

/**
 * The pet's working-phase vocabulary (derived from core session events by the
 * service). Tool-specific phases let a skin with dedicated rows play
 * fetching/searching/analyzing/building/chatting tracks; skins without them
 * fall back to the generic running animation.
 */
export type ActivityPhase =
  | 'idle'
  | 'waiting'
  | 'thinking'
  | 'tool'
  | 'done'
  | 'failed'
  | 'fetching'
  | 'searching'
  | 'analyzing'
  | 'building'
  | 'chatting'

/** The animation contract (spritesheet rows): Codex 9 + tool-specific 5. */
export type PetAnimation =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'
  | 'fetching'
  | 'searching'
  | 'analyzing'
  | 'building'
  | 'chatting'

/** One input snapshot consumed by the machine. */
export interface PetStateInput {
  /** Current working phase of the active session. */
  phase: ActivityPhase
  /** Human-readable status line (plain text). */
  line?: string
  /** Playful phrase from the activity tracker, when any. */
  phrase?: string
}

/** Animation decision plus the copy the pet should show. */
export interface PetStateSnapshot {
  /** Which animation track to play. */
  animation: PetAnimation
  /** Optional status bubble copy (line or phrase), shown while active. */
  bubble?: string
  /** Wall-clock ms this animation started (client can sync loops). */
  animationStartedAt: number
  /** Raw phase, for debugging and client-side rendering decisions. */
  phase: ActivityPhase
  /** True when there is an active session (pet mounted). */
  sessionActive: boolean
}

/** Machine configuration. */
export interface PetStateConfig {
  /** Celebration window after `done` before settling to idle, ms (default 2400). */
  celebrateMs: number
}

export const defaultPetStateConfig: PetStateConfig = { celebrateMs: 2400 }

/**
 * Map one activity phase onto the animation contract.
 * - thinking → `running` (focused work).
 * - tool → `running-right` (side-alternating tool activity).
 * - fetching/searching/analyzing/building/chatting → the tool-specific track
 *   (skins without a dedicated row resolve these to `running` in their row map).
 * - waiting → `waiting`; done → `jumping`; failed → `failed`; idle → `idle`.
 */
export function animationForPhase(phase: ActivityPhase): PetAnimation {
  switch (phase) {
    case 'thinking': return 'running'
    case 'tool': return 'running-right'
    case 'waiting': return 'waiting'
    case 'done': return 'jumping'
    case 'failed': return 'failed'
    case 'fetching': return 'fetching'
    case 'searching': return 'searching'
    case 'analyzing': return 'analyzing'
    case 'building': return 'building'
    case 'chatting': return 'chatting'
    case 'idle': return 'idle'
  }
}

/**
 * PetStateMachine — one instance per host process. Holds only the latest
 * input snapshot and the celebration timing; no storage, no side effects.
 */
export class PetStateMachine {
  private phase: ActivityPhase = 'idle'
  private line: string | undefined
  private phrase: string | undefined
  private sessionActive = false
  private doneAt: number | undefined

  constructor(
    private readonly config: PetStateConfig = defaultPetStateConfig,
    private readonly now: () => number = Date.now,
  ) {}

  /** Consume one phase snapshot (fed by the service from session events). */
  onActivityStatus(input: PetStateInput): void {
    this.phase = input.phase
    this.line = input.line
    this.phrase = input.phrase
    if (input.phase === 'done') this.doneAt = this.now()
  }

  /** A session became the active one (or a fresh session started). */
  onSessionActive(): void {
    this.sessionActive = true
  }

  /** The active session was disposed (or none left). */
  onSessionDisposed(): void {
    this.sessionActive = false
    this.phase = 'idle'
    this.line = undefined
    this.phrase = undefined
    this.doneAt = undefined
  }

  /** Render the current animation decision. */
  render(): PetStateSnapshot {
    const nowMs = this.now()
    let animation = animationForPhase(this.phase)
    // Celebration window: after `done`, jump for celebrateMs then settle idle.
    if (this.phase === 'done' && this.doneAt !== undefined) {
      if (nowMs - this.doneAt < this.config.celebrateMs) {
        animation = 'jumping'
      } else {
        animation = 'idle'
      }
    }
    const bubble = this.phrase ?? this.line
    return {
      animation,
      ...(bubble === undefined ? {} : { bubble }),
      animationStartedAt: nowMs,
      phase: this.phase,
      sessionActive: this.sessionActive,
    }
  }
}

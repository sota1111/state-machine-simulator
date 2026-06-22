import type { StateMachine, Transition } from '../types'

export interface RunStep {
  from_state: string
  event: string
  to_state: string
  transition_id: string
}

export type RunStopReason = 'ok' | 'undefined_event' | 'terminal'

export interface RunResult {
  steps: RunStep[]
  // Index into the input `events` array where playback stopped early, or null if all events ran.
  stoppedAt: number | null
  reason: RunStopReason
}

/**
 * Resolve the next state for a given (currentState, event) pair from the machine transitions.
 * Returns null when no transition matches (undefined event for the current state).
 */
export function resolveNext(
  transitions: Transition[],
  currentState: string,
  event: string,
): { next_state: string; transition_id: string } | null {
  const t = transitions.find(tr => tr.from_state === currentState && tr.event === event)
  if (!t) return null
  return { next_state: t.to_state, transition_id: t.id }
}

/** A state is terminal/sink when it is flagged terminal or has no outgoing transitions. */
function isTerminal(machine: StateMachine, state: string): boolean {
  const flagged = machine.states.find(s => s.name === state)?.is_terminal
  if (flagged) return true
  return machine.transitions.every(tr => tr.from_state !== state)
}

/**
 * Run a sequence of events from the machine's initial state, applying each in order.
 * Stops early on an undefined event or when a terminal/sink state is reached before all
 * events are consumed. Pure: performs no side effects.
 */
export function runSequence(machine: StateMachine, events: string[]): RunResult {
  const steps: RunStep[] = []
  let current = machine.initial_state

  for (let i = 0; i < events.length; i++) {
    if (isTerminal(machine, current)) {
      return { steps, stoppedAt: i, reason: 'terminal' }
    }
    const event = events[i]
    const resolved = resolveNext(machine.transitions, current, event)
    if (!resolved) {
      return { steps, stoppedAt: i, reason: 'undefined_event' }
    }
    steps.push({ from_state: current, event, to_state: resolved.next_state, transition_id: resolved.transition_id })
    current = resolved.next_state
  }

  return { steps, stoppedAt: null, reason: 'ok' }
}

/** Parse a free-form sequence string (comma / whitespace / newline separated) into event names. */
export function parseSequence(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

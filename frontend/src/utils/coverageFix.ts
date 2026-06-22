import type { StateMachine, StateMachineInput } from '../types'
import { analyzeCoverage } from './coverageAnalysis'

// One-click repair suggestions for coverage findings (SOT-1101, 2-B).
// Each suggestion carries the finding kind, a human target descriptor, and a pure
// `build` transform producing the updated StateMachineInput to PUT back to the API.
export type CoverageFixKind = 'deadlock' | 'duplicate' | 'undefined_target'

export interface FixSuggestion {
  kind: CoverageFixKind
  target: string
  build: (m: StateMachine) => StateMachineInput
}

export function machineToInput(m: StateMachine): StateMachineInput {
  return {
    name: m.name,
    description: m.description,
    initial_state: m.initial_state,
    states: m.states.map(s => ({ name: s.name, description: s.description, is_terminal: s.is_terminal })),
    transitions: m.transitions.map(tr => ({ from_state: tr.from_state, to_state: tr.to_state, event: tr.event })),
  }
}

/** Deadlock fix: mark the dead-end (non-terminal, no outgoing) state as terminal. */
export function markTerminal(m: StateMachine, stateName: string): StateMachineInput {
  const input = machineToInput(m)
  return {
    ...input,
    states: input.states.map(s => (s.name === stateName ? { ...s, is_terminal: true } : s)),
  }
}

/** Duplicate fix: keep the first transition for each (from_state, event) pair, drop the rest. */
export function removeDuplicateTransitions(m: StateMachine): StateMachineInput {
  const input = machineToInput(m)
  const seen = new Set<string>()
  const transitions = input.transitions.filter(tr => {
    if (tr.event.trim() === '') return true // leave malformed transitions for their own fix
    const key = `${tr.from_state}\n${tr.event}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { ...input, transitions }
}

/** Undefined-target fix: add the referenced-but-missing state as a new terminal state. */
export function addMissingState(m: StateMachine, stateName: string): StateMachineInput {
  const input = machineToInput(m)
  if (input.states.some(s => s.name === stateName)) return input
  return {
    ...input,
    states: [...input.states, { name: stateName, description: '', is_terminal: true }],
  }
}

/** Map current coverage findings to the subset that can be auto-repaired with one click. */
export function buildFixes(m: StateMachine): FixSuggestion[] {
  const { deadlockStates, duplicateTransitions, undefinedTransitions } = analyzeCoverage(m)
  const stateNames = new Set(m.states.map(s => s.name))
  const fixes: FixSuggestion[] = []

  for (const s of deadlockStates) {
    fixes.push({ kind: 'deadlock', target: s.name, build: mm => markTerminal(mm, s.name) })
  }

  if (duplicateTransitions.length > 0) {
    fixes.push({
      kind: 'duplicate',
      target: String(duplicateTransitions.length),
      build: mm => removeDuplicateTransitions(mm),
    })
  }

  // Only undefined transitions whose sole problem is an unknown target (event present,
  // from-state known) can be auto-fixed by adding the missing state. De-dup by target name.
  const seenTargets = new Set<string>()
  for (const tr of undefinedTransitions) {
    if (tr.event.trim() !== '' && stateNames.has(tr.from_state) && !stateNames.has(tr.to_state)) {
      if (seenTargets.has(tr.to_state)) continue
      seenTargets.add(tr.to_state)
      fixes.push({ kind: 'undefined_target', target: tr.to_state, build: mm => addMissingState(mm, tr.to_state) })
    }
  }

  return fixes
}

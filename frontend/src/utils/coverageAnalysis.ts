import type { State, StateMachine, Transition } from '../types'

// Frontend-only coverage / sanity analysis for a StateMachine (SOT-1036).
// Surfaces structural gaps the existing backend AnalysisResult does not cover:
//   - unreachable states: states NOT reachable from `initial_state`
//   - deadlock states: non-terminal states with no outgoing transition
//   - undefined transitions: transitions whose endpoint name is not a known state,
//     or whose event is blank
//   - duplicate transitions: repeated (from_state, event) pairs (ambiguous routing)
//
// Transitions reference states by `name` (DetailPage machines and InputPage preview
// machines both keep transition endpoints as state names), so reachability is computed
// over the name graph.
export interface CoverageResult {
  unreachableStates: State[]
  deadlockStates: State[]
  undefinedTransitions: Transition[]
  duplicateTransitions: Transition[]
}

// Build a collision-safe dedup key for a (from_state, event) pair. A newline cannot
// appear in a single-line state name or event, so it is a safe separator.
function pairKey(transition: Transition): string {
  return `${transition.from_state}\n${transition.event}`
}

export function analyzeCoverage(machine: StateMachine): CoverageResult {
  const stateNames = new Set(machine.states.map(s => s.name))

  // A transition is "valid" (usable for reachability/deadlock) when both endpoints
  // are known states and it has a non-blank event.
  const isValid = (tr: Transition): boolean =>
    stateNames.has(tr.from_state) && stateNames.has(tr.to_state) && tr.event.trim() !== ''

  const undefinedTransitions = machine.transitions.filter(tr => !isValid(tr))

  // Duplicate (from_state, event) pairs — ambiguous routing. Report every transition
  // that shares its (from_state, event) key with at least one other valid transition.
  const keyCounts = new Map<string, number>()
  for (const tr of machine.transitions) {
    if (!isValid(tr)) continue
    const key = pairKey(tr)
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }
  const duplicateTransitions = machine.transitions.filter(tr => {
    if (!isValid(tr)) return false
    return (keyCounts.get(pairKey(tr)) ?? 0) > 1
  })

  // Reachability BFS from initial_state over valid transitions.
  const adjacency = new Map<string, string[]>()
  for (const tr of machine.transitions) {
    if (!isValid(tr)) continue
    const list = adjacency.get(tr.from_state) ?? []
    list.push(tr.to_state)
    adjacency.set(tr.from_state, list)
  }
  const reachable = new Set<string>()
  if (stateNames.has(machine.initial_state)) {
    const queue: string[] = [machine.initial_state]
    reachable.add(machine.initial_state)
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const next of adjacency.get(current) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next)
          queue.push(next)
        }
      }
    }
  }
  const unreachableStates = machine.states.filter(s => !reachable.has(s.name))

  // Deadlock: a non-terminal state with no outgoing valid transition.
  const hasOutgoing = new Set<string>()
  for (const tr of machine.transitions) {
    if (isValid(tr)) hasOutgoing.add(tr.from_state)
  }
  const deadlockStates = machine.states.filter(
    s => !s.is_terminal && !hasOutgoing.has(s.name),
  )

  return { unreachableStates, deadlockStates, undefinedTransitions, duplicateTransitions }
}

import type { StateMachine, Transition } from '../types'

// All-transition coverage path generation (SOT-1103, 2-D).
// Greedily builds runnable event sequences from the initial state that together cover
// every reachable transition. Each sequence is a list of event names that can be fed
// into the simulator's sequence playback (2-A).

export interface CoverageRun {
  sequences: string[][]
  coveredTransitions: number
  totalReachableTransitions: number
}

function validTransitions(machine: StateMachine): Transition[] {
  const names = new Set(machine.states.map(s => s.name))
  return machine.transitions.filter(
    tr => names.has(tr.from_state) && names.has(tr.to_state) && tr.event.trim() !== '',
  )
}

function isTerminal(machine: StateMachine, state: string, outgoing: Map<string, Transition[]>): boolean {
  if (machine.states.find(s => s.name === state)?.is_terminal) return true
  return (outgoing.get(state) ?? []).length === 0
}

export function generateCoveragePaths(machine: StateMachine): CoverageRun {
  const valid = validTransitions(machine)

  const outgoing = new Map<string, Transition[]>()
  for (const tr of valid) {
    const list = outgoing.get(tr.from_state) ?? []
    list.push(tr)
    outgoing.set(tr.from_state, list)
  }

  // Reachable states from the initial state over valid transitions.
  const reachableStates = new Set<string>()
  const stateNames = new Set(machine.states.map(s => s.name))
  if (stateNames.has(machine.initial_state)) {
    const queue = [machine.initial_state]
    reachableStates.add(machine.initial_state)
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const tr of outgoing.get(cur) ?? []) {
        if (!reachableStates.has(tr.to_state)) {
          reachableStates.add(tr.to_state)
          queue.push(tr.to_state)
        }
      }
    }
  }

  const reachableTransitions = valid.filter(tr => reachableStates.has(tr.from_state))
  const total = reachableTransitions.length

  const visited = new Set<string>()
  const sequences: string[][] = []
  const maxWalkLen = total + machine.states.length + 1
  let guard = total + 1

  while (visited.size < total && guard-- > 0) {
    let current = machine.initial_state
    const events: string[] = []
    let newlyCovered = 0

    for (let i = 0; i < maxWalkLen; i++) {
      const outs = outgoing.get(current) ?? []
      if (outs.length === 0) break
      // Prefer an unvisited transition; otherwise keep moving toward unvisited regions.
      const next = outs.find(tr => !visited.has(tr.id)) ?? outs[0]
      events.push(next.event)
      if (!visited.has(next.id)) {
        visited.add(next.id)
        newlyCovered++
      }
      current = next.to_state
      if (isTerminal(machine, current, outgoing)) break
    }

    if (events.length > 0) sequences.push(events)
    if (newlyCovered === 0) break
  }

  return { sequences, coveredTransitions: visited.size, totalReachableTransitions: total }
}

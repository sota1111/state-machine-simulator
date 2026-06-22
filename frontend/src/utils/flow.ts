import type { StateMachine, Transition } from '../types'

export interface ProcedureStep {
  from_state: string
  event: string
  to_state: string
}

// Derive an ordered, numbered procedure (SOP-style) from a flow by walking transitions
// breadth-first from the start step. Each transition is emitted once; transitions that are
// unreachable from the start step are appended at the end so nothing is silently dropped.
export function buildProcedureSteps(machine: StateMachine): ProcedureStep[] {
  const adjacency = new Map<string, Transition[]>()
  for (const tr of machine.transitions) {
    const list = adjacency.get(tr.from_state)
    if (list) list.push(tr)
    else adjacency.set(tr.from_state, [tr])
  }

  const emitted = new Set<string>()
  const visited = new Set<string>()
  const queue: string[] = []
  const steps: ProcedureStep[] = []

  if (machine.initial_state) {
    queue.push(machine.initial_state)
    visited.add(machine.initial_state)
  }

  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const tr of adjacency.get(current) ?? []) {
      if (emitted.has(tr.id)) continue
      emitted.add(tr.id)
      steps.push({ from_state: tr.from_state, event: tr.event, to_state: tr.to_state })
      if (!visited.has(tr.to_state)) {
        visited.add(tr.to_state)
        queue.push(tr.to_state)
      }
    }
  }

  for (const tr of machine.transitions) {
    if (emitted.has(tr.id)) continue
    emitted.add(tr.id)
    steps.push({ from_state: tr.from_state, event: tr.event, to_state: tr.to_state })
  }

  return steps
}

// PlantUML state-diagram text. State names are quoted so spaces / Japanese names stay valid.
function quote(name: string): string {
  return `"${String(name).replace(/"/g, '')}"`
}

export function toPlantUml(machine: StateMachine): string {
  const lines: string[] = ['@startuml', `title ${machine.name}`]
  if (machine.initial_state) {
    lines.push(`[*] --> ${quote(machine.initial_state)}`)
  }
  for (const tr of machine.transitions) {
    lines.push(`${quote(tr.from_state)} --> ${quote(tr.to_state)} : ${tr.event}`)
  }
  for (const st of machine.states) {
    if (st.is_terminal) lines.push(`${quote(st.name)} --> [*]`)
  }
  lines.push('@enduml')
  return lines.join('\n')
}

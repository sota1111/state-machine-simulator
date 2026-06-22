// Structural diff between two flow snapshots (SOT-1102, 2-C).
// Compares states by name and transitions by `from --[event]--> to`.

export interface FlowSnapshot {
  initial_state: string
  states: { name: string }[]
  transitions: { from_state: string; to_state: string; event: string }[]
}

export interface FlowDiff {
  addedStates: string[]
  removedStates: string[]
  addedTransitions: string[]
  removedTransitions: string[]
  initialChanged: { from: string; to: string } | null
}

export function transitionKey(tr: { from_state: string; to_state: string; event: string }): string {
  return `${tr.from_state} --[${tr.event}]--> ${tr.to_state}`
}

/**
 * Diff from `base` (older) to `target` (newer): "added" = present in target but not base,
 * "removed" = present in base but not target.
 */
export function diffFlows(base: FlowSnapshot, target: FlowSnapshot): FlowDiff {
  const baseStates = new Set(base.states.map(s => s.name))
  const targetStates = new Set(target.states.map(s => s.name))
  const baseTrans = new Set(base.transitions.map(transitionKey))
  const targetTrans = new Set(target.transitions.map(transitionKey))

  return {
    addedStates: [...targetStates].filter(s => !baseStates.has(s)),
    removedStates: [...baseStates].filter(s => !targetStates.has(s)),
    addedTransitions: [...targetTrans].filter(t => !baseTrans.has(t)),
    removedTransitions: [...baseTrans].filter(t => !targetTrans.has(t)),
    initialChanged:
      base.initial_state !== target.initial_state
        ? { from: base.initial_state, to: target.initial_state }
        : null,
  }
}

export function isEmptyDiff(d: FlowDiff): boolean {
  return (
    d.addedStates.length === 0 &&
    d.removedStates.length === 0 &&
    d.addedTransitions.length === 0 &&
    d.removedTransitions.length === 0 &&
    d.initialChanged === null
  )
}

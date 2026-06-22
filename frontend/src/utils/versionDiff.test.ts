import { describe, it, expect } from 'vitest'
import { diffFlows, isEmptyDiff, transitionKey, type FlowSnapshot } from './versionDiff'

const base: FlowSnapshot = {
  initial_state: 'A',
  states: [{ name: 'A' }, { name: 'B' }],
  transitions: [{ from_state: 'A', to_state: 'B', event: 'go' }],
}

describe('diffFlows', () => {
  it('reports added states and transitions', () => {
    const target: FlowSnapshot = {
      initial_state: 'A',
      states: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      transitions: [
        { from_state: 'A', to_state: 'B', event: 'go' },
        { from_state: 'B', to_state: 'C', event: 'next' },
      ],
    }
    const d = diffFlows(base, target)
    expect(d.addedStates).toEqual(['C'])
    expect(d.removedStates).toEqual([])
    expect(d.addedTransitions).toEqual([transitionKey({ from_state: 'B', to_state: 'C', event: 'next' })])
    expect(isEmptyDiff(d)).toBe(false)
  })

  it('reports removed states and initial change', () => {
    const target: FlowSnapshot = {
      initial_state: 'B',
      states: [{ name: 'B' }],
      transitions: [],
    }
    const d = diffFlows(base, target)
    expect(d.removedStates.sort()).toEqual(['A'])
    expect(d.removedTransitions).toHaveLength(1)
    expect(d.initialChanged).toEqual({ from: 'A', to: 'B' })
  })

  it('is empty for identical snapshots', () => {
    expect(isEmptyDiff(diffFlows(base, base))).toBe(true)
  })
})

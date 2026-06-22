import { describe, it, expect } from 'vitest'
import type { StateMachine } from '../types'
import { analyzeCoverage } from './coverageAnalysis'
import { buildFixes, markTerminal, removeDuplicateTransitions, addMissingState } from './coverageFix'

function machine(overrides: Partial<StateMachine> = {}): StateMachine {
  return {
    id: 'm1',
    name: 'flow',
    description: '',
    initial_state: 'A',
    is_sample: false,
    created_at: '',
    updated_at: '',
    states: [
      { id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: false },
      { id: 'B', machine_id: 'm1', name: 'B', description: '', is_terminal: false },
    ],
    transitions: [{ id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' }],
    ...overrides,
  }
}

describe('markTerminal', () => {
  it('marks a deadlock state terminal and clears the finding', () => {
    const m = machine() // B is a non-terminal sink => deadlock
    expect(analyzeCoverage(m).deadlockStates.map(s => s.name)).toEqual(['B'])
    const fixed = markTerminal(m, 'B')
    expect(fixed.states.find(s => s.name === 'B')?.is_terminal).toBe(true)
  })
})

describe('removeDuplicateTransitions', () => {
  it('keeps the first of a duplicated (from,event) pair', () => {
    const m = machine({
      states: [
        { id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: false },
        { id: 'B', machine_id: 'm1', name: 'B', description: '', is_terminal: true },
        { id: 'C', machine_id: 'm1', name: 'C', description: '', is_terminal: true },
      ],
      transitions: [
        { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' },
        { id: 't2', machine_id: 'm1', from_state: 'A', to_state: 'C', event: 'go' },
      ],
    })
    const fixed = removeDuplicateTransitions(m)
    expect(fixed.transitions).toHaveLength(1)
    expect(fixed.transitions[0].to_state).toBe('B')
  })
})

describe('addMissingState', () => {
  it('adds the unknown target as a terminal state', () => {
    const m = machine({
      transitions: [{ id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'Z', event: 'go' }],
    })
    const fixed = addMissingState(m, 'Z')
    expect(fixed.states.map(s => s.name)).toContain('Z')
    expect(fixed.states.find(s => s.name === 'Z')?.is_terminal).toBe(true)
  })
})

describe('buildFixes', () => {
  it('produces a deadlock fix', () => {
    const fixes = buildFixes(machine())
    expect(fixes.some(f => f.kind === 'deadlock' && f.target === 'B')).toBe(true)
  })

  it('produces an undefined_target fix for an unknown destination', () => {
    const m = machine({
      states: [{ id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: false }],
      transitions: [{ id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'Z', event: 'go' }],
    })
    const fixes = buildFixes(m)
    expect(fixes.some(f => f.kind === 'undefined_target' && f.target === 'Z')).toBe(true)
  })
})

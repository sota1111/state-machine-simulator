import { describe, it, expect } from 'vitest'
import type { StateMachine, Transition } from '../types'
import { analyzeCoverage } from './coverageAnalysis'

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
      { id: 'C', machine_id: 'm1', name: 'C', description: '', is_terminal: true },
    ],
    transitions: [
      { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' },
      { id: 't2', machine_id: 'm1', from_state: 'B', to_state: 'C', event: 'finish' },
    ],
    ...overrides,
  }
}

describe('analyzeCoverage', () => {
  it('reports no issues for a clean machine', () => {
    const r = analyzeCoverage(machine())
    expect(r.unreachableStates).toHaveLength(0)
    expect(r.deadlockStates).toHaveLength(0)
    expect(r.undefinedTransitions).toHaveLength(0)
    expect(r.duplicateTransitions).toHaveLength(0)
  })

  it('detects unreachable states', () => {
    const r = analyzeCoverage(
      machine({
        states: [
          { id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: false },
          { id: 'B', machine_id: 'm1', name: 'B', description: '', is_terminal: true },
          { id: 'X', machine_id: 'm1', name: 'X', description: '', is_terminal: true },
        ],
        transitions: [
          { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' },
        ],
      }),
    )
    expect(r.unreachableStates.map(s => s.name)).toEqual(['X'])
  })

  it('detects deadlock (non-terminal state with no outgoing transition)', () => {
    const r = analyzeCoverage(
      machine({
        states: [
          { id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: false },
          { id: 'B', machine_id: 'm1', name: 'B', description: '', is_terminal: false },
        ],
        transitions: [
          { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' },
        ],
      }),
    )
    expect(r.deadlockStates.map(s => s.name)).toEqual(['B'])
  })

  it('detects undefined transitions (unknown endpoint or blank event)', () => {
    const bad: Transition[] = [
      { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'Z', event: 'go' },
      { id: 't2', machine_id: 'm1', from_state: 'A', to_state: 'B', event: '  ' },
    ]
    const r = analyzeCoverage(machine({ transitions: bad }))
    expect(r.undefinedTransitions.map(t => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('detects duplicate (from_state, event) transitions', () => {
    const dup: Transition[] = [
      { id: 't1', machine_id: 'm1', from_state: 'A', to_state: 'B', event: 'go' },
      { id: 't2', machine_id: 'm1', from_state: 'A', to_state: 'C', event: 'go' },
      { id: 't3', machine_id: 'm1', from_state: 'B', to_state: 'C', event: 'finish' },
    ]
    const r = analyzeCoverage(machine({ transitions: dup }))
    expect(r.duplicateTransitions.map(t => t.id).sort()).toEqual(['t1', 't2'])
  })
})

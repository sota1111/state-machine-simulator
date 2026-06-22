import { describe, it, expect } from 'vitest'
import type { StateMachine } from '../types'
import { generateCoveragePaths } from './coveragePaths'
import { runSequence } from './simulationRun'

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
      { id: 't3', machine_id: 'm1', from_state: 'A', to_state: 'C', event: 'skip' },
    ],
    ...overrides,
  }
}

describe('generateCoveragePaths', () => {
  it('covers all reachable transitions', () => {
    const m = machine()
    const run = generateCoveragePaths(m)
    expect(run.totalReachableTransitions).toBe(3)
    expect(run.coveredTransitions).toBe(3)
    expect(run.sequences.length).toBeGreaterThan(0)
  })

  it('produces sequences that are runnable in the simulator', () => {
    const m = machine()
    const run = generateCoveragePaths(m)
    for (const seq of run.sequences) {
      const result = runSequence(m, seq)
      // Each generated step should resolve (no undefined-event stops).
      expect(result.steps.length).toBe(seq.length)
    }
  })

  it('ignores unreachable transitions in the total', () => {
    const m = machine({
      states: [
        { id: 'A', machine_id: 'm1', name: 'A', description: '', is_terminal: true },
        { id: 'X', machine_id: 'm1', name: 'X', description: '', is_terminal: false },
        { id: 'Y', machine_id: 'm1', name: 'Y', description: '', is_terminal: true },
      ],
      transitions: [{ id: 't1', machine_id: 'm1', from_state: 'X', to_state: 'Y', event: 'go' }],
    })
    const run = generateCoveragePaths(m)
    expect(run.totalReachableTransitions).toBe(0)
  })
})

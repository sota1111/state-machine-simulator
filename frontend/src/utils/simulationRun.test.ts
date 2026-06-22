import { describe, it, expect } from 'vitest'
import type { StateMachine } from '../types'
import { resolveNext, runSequence, parseSequence } from './simulationRun'

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

describe('resolveNext', () => {
  it('resolves a matching transition', () => {
    expect(resolveNext(machine().transitions, 'A', 'go')).toEqual({ next_state: 'B', transition_id: 't1' })
  })
  it('returns null for an undefined event', () => {
    expect(resolveNext(machine().transitions, 'A', 'nope')).toBeNull()
  })
})

describe('runSequence', () => {
  it('runs a full valid sequence', () => {
    const r = runSequence(machine(), ['go', 'finish'])
    expect(r.reason).toBe('ok')
    expect(r.stoppedAt).toBeNull()
    expect(r.steps.map(s => s.to_state)).toEqual(['B', 'C'])
  })

  it('stops on an undefined event', () => {
    const r = runSequence(machine(), ['go', 'bogus', 'finish'])
    expect(r.reason).toBe('undefined_event')
    expect(r.stoppedAt).toBe(1)
    expect(r.steps).toHaveLength(1)
  })

  it('stops when a terminal state is reached before the sequence ends', () => {
    const r = runSequence(machine(), ['go', 'finish', 'go'])
    expect(r.reason).toBe('terminal')
    expect(r.stoppedAt).toBe(2)
    expect(r.steps.map(s => s.to_state)).toEqual(['B', 'C'])
  })
})

describe('parseSequence', () => {
  it('splits on commas, spaces and newlines', () => {
    expect(parseSequence('go, finish\n  go ')).toEqual(['go', 'finish', 'go'])
  })
  it('returns empty array for blank input', () => {
    expect(parseSequence('   ')).toEqual([])
  })
})

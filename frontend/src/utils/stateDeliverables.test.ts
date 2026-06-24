import { describe, it, expect } from 'vitest'
import { aggregateStateDeliverables, stageCounts } from './stateDeliverables'
import type { StateMachine, AnalysisResult, ReviewFinding, TestCase } from '../types'
import type { FlowDiff } from './versionDiff'

function st(name: string, is_terminal = false) {
  return { id: `s-${name}`, machine_id: 'm1', name, description: '', is_terminal }
}
function tr(from_state: string, event: string, to_state: string, id?: string) {
  return { id: id ?? `t-${from_state}-${event}-${to_state}`, machine_id: 'm1', from_state, event, to_state }
}

// A: initial → B (ev1); B → A (back); C is unreachable + deadlock (non-terminal, no outgoing).
const machine: StateMachine = {
  id: 'm1',
  name: 'demo',
  description: '',
  initial_state: 'A',
  is_sample: false,
  created_at: '',
  updated_at: '',
  states: [st('A'), st('B', true), st('C')],
  transitions: [tr('A', 'ev1', 'B', 'tAB'), tr('B', 'back', 'A', 'tBA')],
}

describe('aggregateStateDeliverables', () => {
  it('maps coverage unreachable + deadlock onto the offending state', () => {
    const { byState } = aggregateStateDeliverables({ machine })
    const c = byState.get('C') ?? []
    expect(c.some(e => e.stage === 'coverage' && e.kind === 'unreachable')).toBe(true)
    expect(c.some(e => e.stage === 'coverage' && e.kind === 'deadlock')).toBe(true)
    expect(stageCounts(byState.get('C')).coverage).toBeGreaterThanOrEqual(2)
  })

  it('maps analysis results onto states', () => {
    const analysis: AnalysisResult = {
      unreachable_states: ['C'],
      terminal_states: ['B'],
      undefined_events: [],
      state_count: 3,
      transition_count: 2,
      simulation_run_count: 0,
    }
    const { byState } = aggregateStateDeliverables({ machine, analysis })
    expect((byState.get('C') ?? []).some(e => e.stage === 'analysis' && e.kind === 'unreachable')).toBe(true)
    expect((byState.get('B') ?? []).some(e => e.stage === 'analysis' && e.kind === 'terminal')).toBe(true)
  })

  it('maps a review finding to its target state and severity tone', () => {
    const reviewFindings: ReviewFinding[] = [
      { type: 'missing_error_handling', severity: 'error', target: 'B', reason: 'no error path', suggestion: 'add one' },
      { type: 'ambiguous_condition', severity: 'warning', target: 'A --[ev1]--> B', reason: 'ignored', suggestion: '' },
    ]
    const { byState } = aggregateStateDeliverables({ machine, reviewFindings })
    const b = byState.get('B') ?? []
    expect(b.some(e => e.stage === 'review' && e.tone === 'bad')).toBe(true)
    // finding whose target is a transition string is ignored for per-state
    expect((byState.get('A') ?? []).some(e => e.stage === 'review')).toBe(false)
  })

  it('maps test cases onto the states and transitions they touch', () => {
    const testCases: TestCase[] = [
      { category: 'normal', title: 'happy path', expected: 'ok', steps: [{ from_state: 'A', event: 'ev1', to_state: 'B' }] },
    ]
    const { byState, byTransition } = aggregateStateDeliverables({ machine, testCases })
    expect(stageCounts(byState.get('A')).testcase).toBe(1)
    expect(stageCounts(byState.get('B')).testcase).toBe(1)
    expect((byTransition.get('tAB') ?? []).some(e => e.stage === 'testcase')).toBe(true)
  })

  it('maps simulation visited transitions onto endpoints and the edge', () => {
    const { byState, byTransition } = aggregateStateDeliverables({
      machine,
      currentState: 'B',
      visitedTransitionIds: ['tAB'],
    })
    expect((byState.get('A') ?? []).some(e => e.stage === 'simulation' && e.kind === 'visited')).toBe(true)
    expect((byState.get('B') ?? []).some(e => e.stage === 'simulation')).toBe(true)
    expect((byTransition.get('tAB') ?? []).some(e => e.stage === 'simulation')).toBe(true)
  })

  it('maps version diff added states/transitions', () => {
    const versionDiff: FlowDiff = {
      addedStates: ['C'],
      removedStates: [],
      addedTransitions: ['A --[ev1]--> B'],
      removedTransitions: [],
      initialChanged: null,
    }
    const { byState, byTransition } = aggregateStateDeliverables({ machine, versionDiff })
    expect((byState.get('C') ?? []).some(e => e.stage === 'version' && e.kind === 'added')).toBe(true)
    expect((byTransition.get('tAB') ?? []).some(e => e.stage === 'version')).toBe(true)
  })

  it('dedupes identical entries', () => {
    const testCases: TestCase[] = [
      { category: 'normal', title: 'dup', expected: '', steps: [
        { from_state: 'A', event: 'ev1', to_state: 'B' },
        { from_state: 'A', event: 'ev1', to_state: 'B' },
      ] },
    ]
    const { byTransition } = aggregateStateDeliverables({ machine, testCases })
    expect((byTransition.get('tAB') ?? []).filter(e => e.stage === 'testcase').length).toBe(1)
  })
})

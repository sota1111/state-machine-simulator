// Per-state / per-transition aggregation of each 工程's deliverables (SOT-1181).
//
// The detail screen runs several 工程 (stages) over a StateMachine — simulation,
// flow analysis, coverage, design review, test-case generation, version diff — and
// each produces deliverables that are naturally bound to specific states or
// transitions. Historically these only appeared in side panels. This pure helper
// re-keys every deliverable onto the state / transition it concerns so the state
// diagram itself can surface them:
//   - 案A: per-state badges (counts per stage)
//   - 案B: per-state popover (the full entry list)
//   - 案C: per-stage colored overlay of nodes & edges
//
// Everything is keyed by state NAME (transitions reference states by name) except
// the per-transition map, which is keyed by transition id.

import type { StateMachine, AnalysisResult, ReviewFinding, TestCase } from '../types'
import type { FlowDiff } from './versionDiff'
import { transitionKey } from './versionDiff'
import { analyzeCoverage } from './coverageAnalysis'

export type DeliverableStage =
  | 'simulation'
  | 'analysis'
  | 'coverage'
  | 'review'
  | 'testcase'
  | 'version'

export const DELIVERABLE_STAGES: DeliverableStage[] = [
  'simulation',
  'analysis',
  'coverage',
  'review',
  'testcase',
  'version',
]

// One distinct color per stage (used by badges, popover dots, and overlay).
export const STAGE_COLOR: Record<DeliverableStage, string> = {
  simulation: '#4f46e5',
  analysis: '#0ea5e9',
  coverage: '#10b981',
  review: '#f59e0b',
  testcase: '#8b5cf6',
  version: '#ec4899',
}

export type DeliverableTone = 'good' | 'warn' | 'bad' | 'info'

// Resolve a tone to an SVG color for overlay/popover use.
export const TONE_COLOR: Record<DeliverableTone, string> = {
  good: '#16a34a',
  warn: '#d97706',
  bad: '#dc2626',
  info: '#2563eb',
}

export interface DeliverableEntry {
  stage: DeliverableStage
  // Sub-kind within the stage (drives tone / labeling), e.g. 'unreachable', 'deadlock'.
  kind: string
  // Display text. For structural items this is a raw state/event token (the UI applies
  // sampleLabel); for review/testcase it is already human-readable text.
  tone: DeliverableTone
  text: string
}

export interface DeliverableInputs {
  machine: StateMachine
  currentState?: string
  visitedTransitionIds?: string[]
  analysis?: AnalysisResult | null
  reviewFindings?: ReviewFinding[]
  testCases?: TestCase[]
  versionDiff?: FlowDiff | null
}

export interface DeliverableAggregation {
  byState: Map<string, DeliverableEntry[]>
  byTransition: Map<string, DeliverableEntry[]>
}

// Push an entry while de-duplicating identical (stage+kind+text) entries per key.
function push(map: Map<string, DeliverableEntry[]>, key: string, entry: DeliverableEntry): void {
  const list = map.get(key) ?? []
  if (list.some(e => e.stage === entry.stage && e.kind === entry.kind && e.text === entry.text)) return
  list.push(entry)
  map.set(key, list)
}

export function aggregateStateDeliverables(inputs: DeliverableInputs): DeliverableAggregation {
  const { machine, currentState, visitedTransitionIds, analysis, reviewFindings, testCases, versionDiff } = inputs
  const byState = new Map<string, DeliverableEntry[]>()
  const byTransition = new Map<string, DeliverableEntry[]>()
  const stateNames = new Set(machine.states.map(s => s.name))

  // --- simulation: current state + visited transitions (and their endpoints) ---
  if (currentState && stateNames.has(currentState)) {
    push(byState, currentState, { stage: 'simulation', kind: 'current', tone: 'info', text: currentState })
  }
  const visited = new Set(visitedTransitionIds ?? [])
  for (const tr of machine.transitions) {
    if (!visited.has(tr.id)) continue
    push(byTransition, tr.id, { stage: 'simulation', kind: 'visited', tone: 'good', text: tr.event })
    for (const endpoint of [tr.from_state, tr.to_state]) {
      if (stateNames.has(endpoint)) {
        push(byState, endpoint, { stage: 'simulation', kind: 'visited', tone: 'good', text: endpoint })
      }
    }
  }

  // --- analysis: backend AnalysisResult (unreachable / terminal states) ---
  if (analysis) {
    for (const name of analysis.unreachable_states) {
      if (stateNames.has(name)) push(byState, name, { stage: 'analysis', kind: 'unreachable', tone: 'bad', text: name })
    }
    for (const name of analysis.terminal_states) {
      if (stateNames.has(name)) push(byState, name, { stage: 'analysis', kind: 'terminal', tone: 'info', text: name })
    }
  }

  // --- coverage: frontend structural analysis ---
  const coverage = analyzeCoverage(machine)
  for (const s of coverage.unreachableStates) {
    push(byState, s.name, { stage: 'coverage', kind: 'unreachable', tone: 'bad', text: s.name })
  }
  for (const s of coverage.deadlockStates) {
    push(byState, s.name, { stage: 'coverage', kind: 'deadlock', tone: 'bad', text: s.name })
  }
  for (const tr of coverage.undefinedTransitions) {
    if (stateNames.has(tr.from_state)) {
      push(byState, tr.from_state, { stage: 'coverage', kind: 'undefined_transition', tone: 'warn', text: tr.event || tr.to_state })
    }
    push(byTransition, tr.id, { stage: 'coverage', kind: 'undefined_transition', tone: 'warn', text: tr.event })
  }
  for (const tr of coverage.duplicateTransitions) {
    if (stateNames.has(tr.from_state)) {
      push(byState, tr.from_state, { stage: 'coverage', kind: 'duplicate_transition', tone: 'warn', text: tr.event })
    }
    push(byTransition, tr.id, { stage: 'coverage', kind: 'duplicate_transition', tone: 'warn', text: tr.event })
  }

  // --- review: findings whose target is a known state name ---
  for (const f of reviewFindings ?? []) {
    if (!f.target || !stateNames.has(f.target)) continue
    const tone: DeliverableTone = f.severity === 'error' ? 'bad' : f.severity === 'warning' ? 'warn' : 'info'
    push(byState, f.target, { stage: 'review', kind: f.type, tone, text: f.reason })
  }

  // --- testcase: states & transitions touched by a generated case ---
  for (const tc of testCases ?? []) {
    const touchedStates = new Set<string>()
    for (const step of tc.steps) {
      if (stateNames.has(step.from_state)) touchedStates.add(step.from_state)
      if (stateNames.has(step.to_state)) touchedStates.add(step.to_state)
      const match = machine.transitions.find(
        t => t.from_state === step.from_state && t.to_state === step.to_state && t.event === step.event,
      )
      if (match) push(byTransition, match.id, { stage: 'testcase', kind: 'covered', tone: 'good', text: tc.title })
    }
    for (const name of touchedStates) {
      push(byState, name, { stage: 'testcase', kind: 'covered', tone: 'good', text: tc.title })
    }
  }

  // --- version: diff between a selected snapshot and the current machine ---
  if (versionDiff) {
    for (const name of versionDiff.addedStates) {
      if (stateNames.has(name)) push(byState, name, { stage: 'version', kind: 'added', tone: 'good', text: name })
    }
    const addedTrans = new Set(versionDiff.addedTransitions)
    for (const tr of machine.transitions) {
      if (addedTrans.has(transitionKey(tr))) {
        push(byTransition, tr.id, { stage: 'version', kind: 'added', tone: 'good', text: tr.event })
        if (stateNames.has(tr.from_state)) {
          push(byState, tr.from_state, { stage: 'version', kind: 'added', tone: 'good', text: tr.event })
        }
      }
    }
  }

  return { byState, byTransition }
}

// Per-stage counts for a single state/transition's entries (badge rendering, 案A).
export function stageCounts(entries: DeliverableEntry[] | undefined): Record<DeliverableStage, number> {
  const counts: Record<DeliverableStage, number> = {
    simulation: 0,
    analysis: 0,
    coverage: 0,
    review: 0,
    testcase: 0,
    version: 0,
  }
  for (const e of entries ?? []) counts[e.stage] += 1
  return counts
}

export interface State {
  id: string
  machine_id: string
  name: string
  description: string
  is_terminal: boolean
  // Optional parent/super state grouping this state belongs to (hierarchical display).
  parent?: string | null
}

export interface Transition {
  id: string
  machine_id: string
  from_state: string
  to_state: string
  event: string
}

export interface StateMachine {
  id: string
  name: string
  description: string
  initial_state: string
  is_sample: boolean
  created_at: string
  updated_at: string
  states: State[]
  transitions: Transition[]
}

export type StateInput = Pick<State, 'name' | 'description' | 'is_terminal'>

export type TransitionInput = Pick<Transition, 'from_state' | 'to_state' | 'event'>

export interface StateMachineInput {
  name: string
  description: string
  initial_state: string
  states: StateInput[]
  transitions: TransitionInput[]
}

export interface SimulationStep {
  state: string
  event: string
  next_state: string
}

export interface SimulationHistory {
  id: string
  machine_id: string
  executed_at: string
  steps: SimulationStep[]
}

export interface SimulateRequest {
  current_state: string
  event: string
}

export interface SimulateResponse {
  success: boolean
  next_state: string | null
  message: string
}

export interface AnalysisResult {
  unreachable_states: string[]
  terminal_states: string[]
  undefined_events: string[]
  state_count: number
  transition_count: number
  simulation_run_count: number
}

// Version history (SOT-1102)
export interface StateMachineVersionSummary {
  version: number
  saved_at: string
}

export interface StateMachineVersion {
  version: number
  saved_at: string
  name: string
  description: string
  initial_state: string
  states: State[]
  transitions: Transition[]
}

export interface ParseRequest {
  text: string
}

export interface ParseResponse {
  name: string
  description: string
  initial_state: string
  states: Array<{ name: string; description: string; is_terminal: boolean }>
  transitions: Array<{ from_state: string; to_state: string; event: string }>
  // Unique event names derived from the transitions (SOT-1095).
  events: string[]
}

export interface RefineRequest {
  instruction: string
  name: string
  description: string
  initial_state: string
  states: Array<{ name: string; description: string; is_terminal: boolean }>
  transitions: Array<{ from_state: string; to_state: string; event: string }>
}

// Design-review (SOT-1096)
export type ReviewFindingType =
  | 'unreachable_state'
  | 'undefined_event'
  | 'non_terminating'
  | 'missing_error_handling'
  | 'missing_cancel'
  | 'missing_timeout'
  | 'ambiguous_condition'

export type ReviewSeverity = 'error' | 'warning' | 'info'

export interface ReviewFinding {
  type: ReviewFindingType
  severity: ReviewSeverity
  target: string
  reason: string
  suggestion: string
}

export interface ReviewRequest {
  initial_state: string
  states: Array<{ name: string; description: string; is_terminal: boolean }>
  transitions: Array<{ from_state: string; to_state: string; event: string }>
  spec_text?: string
}

export interface ReviewResponse {
  findings: ReviewFinding[]
  ai_used: boolean
}

// Test-case generation (SOT-1097)
export type TestCaseCategory = 'normal' | 'abnormal' | 'cancel' | 'timeout'

export interface TestCaseStep {
  from_state: string
  event: string
  to_state: string
}

export interface TestCase {
  category: TestCaseCategory
  title: string
  steps: TestCaseStep[]
  expected: string
}

export interface TestCaseRequest {
  initial_state: string
  states: Array<{ name: string; description: string; is_terminal: boolean }>
  transitions: Array<{ from_state: string; to_state: string; event: string }>
}

export interface TestCaseResponse {
  cases: TestCase[]
}

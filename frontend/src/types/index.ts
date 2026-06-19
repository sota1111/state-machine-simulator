export interface State {
  id: string
  machine_id: string
  name: string
  description: string
  is_terminal: boolean
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

export interface ParseRequest {
  text: string
}

export interface ParseResponse {
  name: string
  description: string
  initial_state: string
  states: Array<{ name: string; description: string; is_terminal: boolean }>
  transitions: Array<{ from_state: string; to_state: string; event: string }>
}

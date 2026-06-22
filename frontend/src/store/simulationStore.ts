import { create } from 'zustand'

interface SimulationState {
  currentState: string | undefined
  visitedTransitionIds: string[]
  log: string[]
  // A sequence pushed in from another panel (e.g. test-case "run in simulator", SOT-1103).
  // SimulationPanel consumes and clears it.
  pendingSequence: string[] | null

  // Actions
  setCurrentState: (state: string) => void
  addVisitedTransition: (transitionId: string) => void
  addLog: (message: string) => void
  reset: (initialState: string, label?: string) => void
  initForMachine: (initialState: string, label?: string) => void
  addStep: (transitionId: string, fromState: string, event: string, nextState: string) => void
  setPendingSequence: (events: string[] | null) => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  currentState: undefined,
  visitedTransitionIds: [],
  log: [],
  pendingSequence: null,

  setCurrentState: (state) => set({ currentState: state }),

  setPendingSequence: (events) => set({ pendingSequence: events }),
  
  addVisitedTransition: (transitionId) => 
    set((state) => ({
      visitedTransitionIds: state.visitedTransitionIds.includes(transitionId) 
        ? state.visitedTransitionIds 
        : [...state.visitedTransitionIds, transitionId]
    })),

  addLog: (message) => set((state) => ({ log: [...state.log, message] })),

  reset: (initialState, label) => set({
    currentState: initialState,
    visitedTransitionIds: [],
    log: [`${label ?? 'リセット → 初期状態'}: ${initialState}`]
  }),

  initForMachine: (initialState, label) => set({
    currentState: initialState,
    visitedTransitionIds: [],
    log: [`${label ?? '初期状態'}: ${initialState}`]
  }),

  addStep: (transitionId, fromState, event, nextState) =>
    set((state) => ({
      currentState: nextState,
      visitedTransitionIds: state.visitedTransitionIds.includes(transitionId)
        ? state.visitedTransitionIds
        : [...state.visitedTransitionIds, transitionId],
      log: [...state.log, `${fromState} --[${event}]--> ${nextState}`]
    }))
}))

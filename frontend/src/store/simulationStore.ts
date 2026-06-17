import { create } from 'zustand'

interface SimulationState {
  currentState: string | undefined
  visitedTransitionIds: string[]
  log: string[]
  
  // Actions
  setCurrentState: (state: string) => void
  addVisitedTransition: (transitionId: string) => void
  addLog: (message: string) => void
  reset: (initialState: string) => void
  initForMachine: (initialState: string) => void
  addStep: (transitionId: string, fromState: string, event: string, nextState: string) => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  currentState: undefined,
  visitedTransitionIds: [],
  log: [],

  setCurrentState: (state) => set({ currentState: state }),
  
  addVisitedTransition: (transitionId) => 
    set((state) => ({
      visitedTransitionIds: state.visitedTransitionIds.includes(transitionId) 
        ? state.visitedTransitionIds 
        : [...state.visitedTransitionIds, transitionId]
    })),

  addLog: (message) => set((state) => ({ log: [...state.log, message] })),

  reset: (initialState) => set({
    currentState: initialState,
    visitedTransitionIds: [],
    log: [`リセット → 初期状態: ${initialState}`]
  }),

  initForMachine: (initialState) => set({
    currentState: initialState,
    visitedTransitionIds: [],
    log: [`初期状態: ${initialState}`]
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

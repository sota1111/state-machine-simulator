from ..schemas import AnalysisResponse

def analyze_state_machine(machine, states, transitions, sim_count):
    state_names = {s.name for s in states}
    initial_state = machine.initial_state
    
    # unreachable_states: states with no incoming transitions (except initial_state)
    incoming_states = {t.to_state for t in transitions}
    unreachable_states = [
        s.name for s in states 
        if s.name != initial_state and s.name not in incoming_states
    ]
    
    # terminal_states: states with no outgoing transitions
    outgoing_states = {t.from_state for t in transitions}
    terminal_states = [
        s.name for s in states 
        if s.name not in outgoing_states
    ]
    
    # undefined_events: events where (from_state, event) pair exists but transition leads to undefined state
    undefined_events = []
    for t in transitions:
        if t.to_state not in state_names:
            undefined_events.append(f"{t.from_state} --[{t.event}]--> {t.to_state} (undefined)")

    return AnalysisResponse(
        unreachable_states=unreachable_states,
        terminal_states=terminal_states,
        undefined_events=undefined_events,
        state_count=len(states),
        transition_count=len(transitions),
        simulation_run_count=sim_count
    )

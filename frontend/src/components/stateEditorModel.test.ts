import { describe, it, expect } from 'vitest'
import type { StateMachine } from '../types'
import {
  fromStateMachine,
  addNode,
  moveNode,
  updateNode,
  removeNode,
  setInitial,
  addEdge,
  updateEdgeEvent,
  removeEdge,
  arrangeLayout,
  toStateMachineInput,
} from './stateEditorModel'

function sampleMachine(): StateMachine {
  return {
    id: 'm1',
    name: 'ログインフロー',
    description: 'desc',
    initial_state: 'ログアウト',
    is_sample: false,
    created_at: '',
    updated_at: '',
    states: [
      { id: 's1', machine_id: 'm1', name: 'ログアウト', description: '', is_terminal: false },
      { id: 's2', machine_id: 'm1', name: 'ログイン中', description: '', is_terminal: true },
    ],
    transitions: [
      { id: 't1', machine_id: 'm1', from_state: 'ログアウト', to_state: 'ログイン中', event: 'login' },
    ],
  }
}

describe('fromStateMachine', () => {
  it('maps states and transitions and resolves the initial node', () => {
    const m = fromStateMachine(sampleMachine())
    expect(m.nodes).toHaveLength(2)
    expect(m.edges).toHaveLength(1)
    const initial = m.nodes.find(n => n.id === m.initialId)
    expect(initial?.name).toBe('ログアウト')
    const edge = m.edges[0]
    expect(edge.from).toBe(m.nodes.find(n => n.name === 'ログアウト')!.id)
    expect(edge.to).toBe(m.nodes.find(n => n.name === 'ログイン中')!.id)
  })
})

describe('node operations', () => {
  it('addNode appends a uniquely named node', () => {
    const m0 = fromStateMachine(sampleMachine())
    const m1 = addNode(m0)
    expect(m1.nodes).toHaveLength(3)
    const names = m1.nodes.map(n => n.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('addNode on an empty model sets the new node as initial', () => {
    const empty = { name: '', description: '', initialId: null, nodes: [], edges: [] }
    const m = addNode(empty)
    expect(m.initialId).toBe(m.nodes[0].id)
  })

  it('moveNode updates coordinates', () => {
    const m0 = fromStateMachine(sampleMachine())
    const id = m0.nodes[0].id
    const m1 = moveNode(m0, id, 123, 456)
    const moved = m1.nodes.find(n => n.id === id)!
    expect(moved.x).toBe(123)
    expect(moved.y).toBe(456)
  })

  it('updateNode patches fields', () => {
    const m0 = fromStateMachine(sampleMachine())
    const id = m0.nodes[0].id
    const m1 = updateNode(m0, id, { name: '新名称', is_terminal: true })
    const n = m1.nodes.find(x => x.id === id)!
    expect(n.name).toBe('新名称')
    expect(n.is_terminal).toBe(true)
  })

  it('removeNode also removes connected edges and reassigns the initial', () => {
    const m0 = fromStateMachine(sampleMachine())
    const initialId = m0.initialId!
    const m1 = removeNode(m0, initialId)
    expect(m1.nodes).toHaveLength(1)
    expect(m1.edges).toHaveLength(0)
    expect(m1.initialId).toBe(m1.nodes[0].id)
  })

  it('setInitial only accepts existing nodes', () => {
    const m0 = fromStateMachine(sampleMachine())
    const target = m0.nodes[1].id
    expect(setInitial(m0, target).initialId).toBe(target)
    expect(setInitial(m0, 'missing').initialId).toBe(m0.initialId)
  })
})

describe('edge operations', () => {
  it('addEdge creates a transition between two nodes', () => {
    const m0 = fromStateMachine(sampleMachine())
    const a = m0.nodes[0].id
    const b = m0.nodes[1].id
    const m1 = addEdge(m0, b, a, 'logout')
    expect(m1.edges).toHaveLength(2)
    expect(m1.edges.some(e => e.from === b && e.to === a && e.event === 'logout')).toBe(true)
  })

  it('addEdge ignores unknown node ids', () => {
    const m0 = fromStateMachine(sampleMachine())
    const m1 = addEdge(m0, 'nope', m0.nodes[0].id)
    expect(m1.edges).toHaveLength(1)
  })

  it('updateEdgeEvent and removeEdge work', () => {
    const m0 = fromStateMachine(sampleMachine())
    const edgeId = m0.edges[0].id
    const m1 = updateEdgeEvent(m0, edgeId, 'renamed')
    expect(m1.edges[0].event).toBe('renamed')
    const m2 = removeEdge(m1, edgeId)
    expect(m2.edges).toHaveLength(0)
  })
})

describe('arrangeLayout', () => {
  it('lays out successive layers downward (y) when vertical', () => {
    const m = arrangeLayout(fromStateMachine(sampleMachine()), true)
    const out = m.nodes.find(n => n.name === 'ログアウト')!
    const inn = m.nodes.find(n => n.name === 'ログイン中')!
    // ログアウト → ログイン中, so the target sits in the next layer (further down).
    expect(inn.y).toBeGreaterThan(out.y)
    expect(inn.x).toBe(out.x)
  })

  it('lays out successive layers rightward (x) when horizontal', () => {
    const m = arrangeLayout(fromStateMachine(sampleMachine()), false)
    const out = m.nodes.find(n => n.name === 'ログアウト')!
    const inn = m.nodes.find(n => n.name === 'ログイン中')!
    expect(inn.x).toBeGreaterThan(out.x)
    expect(inn.y).toBe(out.y)
  })

  it('preserves node identity, edges and the initial state', () => {
    const m0 = fromStateMachine(sampleMachine())
    const m1 = arrangeLayout(m0, true)
    expect(m1.nodes.map(n => n.id).sort()).toEqual(m0.nodes.map(n => n.id).sort())
    expect(m1.edges).toEqual(m0.edges)
    expect(m1.initialId).toBe(m0.initialId)
  })
})

describe('toStateMachineInput', () => {
  it('round-trips a machine back into input form', () => {
    const m0 = fromStateMachine(sampleMachine())
    const input = toStateMachineInput(m0)
    expect(input.name).toBe('ログインフロー')
    expect(input.initial_state).toBe('ログアウト')
    expect(input.states.map(s => s.name).sort()).toEqual(['ログアウト', 'ログイン中'])
    expect(input.transitions).toEqual([
      { from_state: 'ログアウト', to_state: 'ログイン中', event: 'login' },
    ])
  })

  it('reflects edits (rename + new transition) into the input', () => {
    let m = fromStateMachine(sampleMachine())
    const loggedIn = m.nodes.find(n => n.name === 'ログイン中')!
    const loggedOut = m.nodes.find(n => n.name === 'ログアウト')!
    m = updateNode(m, loggedIn.id, { name: 'オンライン' })
    m = addEdge(m, loggedIn.id, loggedOut.id, 'logout')
    const input = toStateMachineInput(m)
    expect(input.states.map(s => s.name).sort()).toEqual(['オンライン', 'ログアウト'])
    expect(input.transitions).toContainEqual({ from_state: 'ログアウト', to_state: 'オンライン', event: 'login' })
    expect(input.transitions).toContainEqual({ from_state: 'オンライン', to_state: 'ログアウト', event: 'logout' })
  })

  it('drops blank-named nodes and their edges', () => {
    let m = fromStateMachine(sampleMachine())
    m = updateNode(m, m.nodes[0].id, { name: '   ' })
    const input = toStateMachineInput(m)
    expect(input.states).toHaveLength(1)
    expect(input.transitions).toHaveLength(0)
  })
})

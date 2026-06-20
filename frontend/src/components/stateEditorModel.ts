import type { StateMachine, StateMachineInput } from '../types'

// Internal, fully-editable representation of a state machine used by the visual
// drag editor. Nodes and edges are keyed by a stable local `id` (independent of
// the user-editable `name`) so that renaming a state does not break the edges
// that reference it. On save the model is converted back to `StateMachineInput`,
// where transitions reference states by name (the backend's contract).

export interface EditorNode {
  id: string
  name: string
  description: string
  is_terminal: boolean
  x: number
  y: number
}

export interface EditorEdge {
  id: string
  from: string // EditorNode.id
  to: string // EditorNode.id
  event: string
}

export interface EditorModel {
  name: string
  description: string
  initialId: string | null // EditorNode.id of the initial state
  nodes: EditorNode[]
  edges: EditorEdge[]
}

export const NODE_WIDTH = 160
export const NODE_HEIGHT = 56

let idCounter = 0
function genId(prefix: string): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `${prefix}-${c.randomUUID()}`
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

// Simple BFS layered layout (left→right) used to seed initial node positions
// from a machine that has no stored coordinates.
function computeLayout(
  stateNames: string[],
  transitions: Array<{ from_state: string; to_state: string }>,
  initial: string,
): Map<string, { x: number; y: number }> {
  const LAYER_GAP = 120
  const SIBLING_GAP = 48
  const MARGIN = 24

  const depth = new Map<string, number>()
  const queue: Array<[string, number]> = []
  if (stateNames.includes(initial)) {
    queue.push([initial, 0])
    depth.set(initial, 0)
  }
  while (queue.length > 0) {
    const [name, d] = queue.shift()!
    for (const t of transitions) {
      if (t.from_state === name && !depth.has(t.to_state) && stateNames.includes(t.to_state)) {
        depth.set(t.to_state, d + 1)
        queue.push([t.to_state, d + 1])
      }
    }
  }
  let maxDepth = 0
  depth.forEach(d => { maxDepth = Math.max(maxDepth, d) })
  for (const name of stateNames) {
    if (!depth.has(name)) {
      maxDepth += 1
      depth.set(name, maxDepth)
    }
  }

  const columns = new Map<number, string[]>()
  depth.forEach((d, name) => {
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d)!.push(name)
  })

  const pos = new Map<string, { x: number; y: number }>()
  Array.from(columns.keys()).sort((a, b) => a - b).forEach(col => {
    columns.get(col)!.forEach((name, row) => {
      pos.set(name, {
        x: col * (NODE_WIDTH + LAYER_GAP) + MARGIN,
        y: row * (NODE_HEIGHT + SIBLING_GAP) + MARGIN,
      })
    })
  })
  return pos
}

export function fromStateMachine(machine: StateMachine): EditorModel {
  const layout = computeLayout(
    machine.states.map(s => s.name),
    machine.transitions,
    machine.initial_state,
  )

  const nodes: EditorNode[] = machine.states.map(s => {
    const p = layout.get(s.name) ?? { x: 24, y: 24 }
    return {
      id: genId('node'),
      name: s.name,
      description: s.description,
      is_terminal: s.is_terminal,
      x: p.x,
      y: p.y,
    }
  })

  const nameToId = new Map<string, string>()
  nodes.forEach(n => nameToId.set(n.name, n.id))

  const edges: EditorEdge[] = []
  for (const t of machine.transitions) {
    const from = nameToId.get(t.from_state)
    const to = nameToId.get(t.to_state)
    if (!from || !to) continue
    edges.push({ id: genId('edge'), from, to, event: t.event })
  }

  const initialId = nameToId.get(machine.initial_state) ?? (nodes[0]?.id ?? null)

  return {
    name: machine.name,
    description: machine.description,
    initialId,
    nodes,
    edges,
  }
}

function uniqueName(model: EditorModel): string {
  const existing = new Set(model.nodes.map(n => n.name))
  let i = model.nodes.length + 1
  let candidate = `状態${i}`
  while (existing.has(candidate)) {
    i += 1
    candidate = `状態${i}`
  }
  return candidate
}

export function addNode(model: EditorModel, x = 40, y = 40): EditorModel {
  const node: EditorNode = {
    id: genId('node'),
    name: uniqueName(model),
    description: '',
    is_terminal: false,
    x,
    y,
  }
  return {
    ...model,
    nodes: [...model.nodes, node],
    // First node added to an empty machine becomes the initial state.
    initialId: model.initialId ?? node.id,
  }
}

export function moveNode(model: EditorModel, id: string, x: number, y: number): EditorModel {
  return {
    ...model,
    nodes: model.nodes.map(n => (n.id === id ? { ...n, x, y } : n)),
  }
}

export function updateNode(
  model: EditorModel,
  id: string,
  patch: Partial<Pick<EditorNode, 'name' | 'description' | 'is_terminal'>>,
): EditorModel {
  return {
    ...model,
    nodes: model.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)),
  }
}

export function removeNode(model: EditorModel, id: string): EditorModel {
  const nodes = model.nodes.filter(n => n.id !== id)
  const edges = model.edges.filter(e => e.from !== id && e.to !== id)
  const initialId = model.initialId === id ? (nodes[0]?.id ?? null) : model.initialId
  return { ...model, nodes, edges, initialId }
}

export function setInitial(model: EditorModel, id: string): EditorModel {
  if (!model.nodes.some(n => n.id === id)) return model
  return { ...model, initialId: id }
}

export function addEdge(model: EditorModel, from: string, to: string, event = ''): EditorModel {
  const hasFrom = model.nodes.some(n => n.id === from)
  const hasTo = model.nodes.some(n => n.id === to)
  if (!hasFrom || !hasTo) return model
  const edge: EditorEdge = { id: genId('edge'), from, to, event }
  return { ...model, edges: [...model.edges, edge] }
}

export function updateEdgeEvent(model: EditorModel, id: string, event: string): EditorModel {
  return {
    ...model,
    edges: model.edges.map(e => (e.id === id ? { ...e, event } : e)),
  }
}

export function removeEdge(model: EditorModel, id: string): EditorModel {
  return { ...model, edges: model.edges.filter(e => e.id !== id) }
}

// Convert the editor model back to the persisted `StateMachineInput` contract.
// Transitions are emitted using the (possibly renamed) state names; nodes whose
// name is blank are dropped along with any edges that reference them.
export function toStateMachineInput(model: EditorModel): StateMachineInput {
  const idToName = new Map<string, string>()
  const states = model.nodes
    .filter(n => n.name.trim())
    .map(n => {
      idToName.set(n.id, n.name)
      return { name: n.name, description: n.description, is_terminal: n.is_terminal }
    })

  const transitions = model.edges
    .map(e => {
      const from_state = idToName.get(e.from)
      const to_state = idToName.get(e.to)
      if (!from_state || !to_state) return null
      return { from_state, to_state, event: e.event }
    })
    .filter((t): t is { from_state: string; to_state: string; event: string } => t !== null)

  const initialName =
    (model.initialId && idToName.get(model.initialId)) || states[0]?.name || ''

  return {
    name: model.name,
    description: model.description,
    initial_state: initialName,
    states,
    transitions,
  }
}

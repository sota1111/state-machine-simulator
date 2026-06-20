import { useState } from 'react'
import { useSimulationStore } from '../store/simulationStore'
import type { StateMachine, State, Transition } from '../types'

interface Props {
  machine: StateMachine
  // Controlled orientation. When `isVertical` is provided, the diagram uses it and the
  // 遷移方向 toggle calls `onToggleVertical` instead of managing orientation internally.
  // When omitted, the component falls back to its own responsive default + internal toggle.
  isVertical?: boolean
  onToggleVertical?: () => void
}

interface NodePos {
  x: number
  y: number
  width: number
  height: number
  state: State
}

export default function StateDiagram({ machine, isVertical: controlledVertical, onToggleVertical }: Props) {
  const currentState = useSimulationStore(state => state.currentState) ?? machine.initial_state
  const visitedTransitionIdsArr = useSimulationStore(state => state.visitedTransitionIds)
  const visitedTransitionIds = new Set(visitedTransitionIdsArr)

  // The diagram lays out top-to-bottom (vertical) by default on every screen size:
  // BFS depth advances down the y axis and siblings spread across the x axis.
  // This is the *default*; the user can override it with the toggle button below to get
  // the left-to-right (horizontal) layout.
  // null = follow the default (vertical); true/false = explicit user choice.
  const [orientationOverride, setOrientationOverride] = useState<boolean | null>(null)
  // Controlled mode: a parent owns the orientation (so it can also drive page layout).
  const isControlled = controlledVertical !== undefined
  const isVertical = isControlled ? controlledVertical : (orientationOverride ?? true)
  const toggleVertical = () => {
    if (isControlled) {
      onToggleVertical?.()
    } else {
      setOrientationOverride(!isVertical)
    }
  }

  // On desktop the diagram is shown full-width (simulation moved below it), so use
  // larger nodes and gaps to make the diagram bigger and easier to read.
  const NODE_WIDTH = isVertical ? 140 : 180
  const NODE_HEIGHT = isVertical ? 44 : 56
  // LAYER_GAP = spacing along the flow direction (between BFS depths);
  // SIBLING_GAP = spacing perpendicular to flow (between nodes in the same depth).
  const LAYER_GAP = isVertical ? 64 : 120
  const SIBLING_GAP = isVertical ? 40 : 48

  // Parent/super states: when any state declares a `parent`, related states are
  // grouped inside a labeled container box to make complex machines easier to read.
  const hasGroups = machine.states.some(s => !!s.parent)
  // Extra outer margin so group boxes and their labels are not clipped.
  const MARGIN = hasGroups ? 40 : 20
  const GROUP_PADDING = 14
  const GROUP_LABEL_H = 18

  // 1. BFS to determine layers
  const layers: Map<string, number> = new Map()
  const queue: [string, number][] = [[machine.initial_state, 0]]
  const visited = new Set<string>([machine.initial_state])

  while (queue.length > 0) {
    const [name, depth] = queue.shift()!
    layers.set(name, depth)

    const nextStates = machine.transitions
      .filter(t => t.from_state === name)
      .map(t => t.to_state)

    for (const next of nextStates) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([next, depth + 1])
      }
    }
  }

  // Handle unreachable states
  const maxDepth = Array.from(layers.values()).reduce((a, b) => Math.max(a, b), 0)
  for (const s of machine.states) {
    if (!layers.has(s.name)) {
      layers.set(s.name, maxDepth + 1)
    }
  }

  // 2. Assign positions
  const nodePositions: Map<string, NodePos> = new Map()
  let maxColWidth = 0
  let maxRowHeight = 0

  if (hasGroups) {
    // Group-aware (swimlane) layout: each parent group occupies its own contiguous BAND
    // perpendicular to the flow axis. This keeps every parent's children together and
    // guarantees the group boxes never overlap, so each parent visibly encloses only its
    // own child states. The flow axis stays driven by BFS depth (shared across lanes).
    const UNGROUPED = '__ungrouped__'
    const LANE_GAP = 34
    // Lane order = first-appearance order of parents; the ungrouped lane (if any) goes last.
    const laneOrder: string[] = []
    machine.states.forEach((s) => {
      const lane = s.parent ?? UNGROUPED
      if (!laneOrder.includes(lane)) laneOrder.push(lane)
    })
    laneOrder.sort((a, b) => (a === UNGROUPED ? 1 : 0) - (b === UNGROUPED ? 1 : 0))

    // laneCursor advances along the cross axis (y in horizontal mode, x in vertical mode).
    let laneCursor = MARGIN
    laneOrder.forEach((lane) => {
      const laneStates = machine.states.filter((s) => (s.parent ?? UNGROUPED) === lane)
      // Bucket this lane's states by BFS depth so the flow direction is preserved.
      const byDepth: Map<number, string[]> = new Map()
      laneStates.forEach((s) => {
        const d = layers.get(s.name) ?? 0
        if (!byDepth.has(d)) byDepth.set(d, [])
        byDepth.get(d)!.push(s.name)
      })
      // Cross-axis size of the lane = the most states sharing a single depth.
      const crossCount = Math.max(1, ...Array.from(byDepth.values()).map((a) => a.length))
      // Reserve room at the top of a grouped lane for its parent label (horizontal mode).
      // Vertical mode draws the label at the box top, so no cross-axis reserve is needed.
      const crossReserve = lane === UNGROUPED || isVertical ? 0 : GROUP_LABEL_H + GROUP_PADDING

      byDepth.forEach((names, depth) => {
        names.forEach((name, crossIdx) => {
          const state = machine.states.find((s) => s.name === name)!
          let x: number
          let y: number
          if (isVertical) {
            x = laneCursor + crossReserve + crossIdx * (NODE_WIDTH + SIBLING_GAP)
            y = depth * (NODE_HEIGHT + LAYER_GAP) + MARGIN
          } else {
            x = depth * (NODE_WIDTH + LAYER_GAP) + MARGIN
            y = laneCursor + crossReserve + crossIdx * (NODE_HEIGHT + SIBLING_GAP)
          }
          nodePositions.set(name, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, state })
          maxColWidth = Math.max(maxColWidth, x + NODE_WIDTH + MARGIN)
          maxRowHeight = Math.max(maxRowHeight, y + NODE_HEIGHT + MARGIN)
        })
      })

      const nodeSpan = isVertical ? NODE_WIDTH : NODE_HEIGHT
      const band = crossReserve + crossCount * (nodeSpan + SIBLING_GAP)
      laneCursor += band + GROUP_PADDING + LANE_GAP
    })
  } else {
    // Flat layout: position nodes purely by BFS depth (no parent grouping).
    const columns: Map<number, string[]> = new Map()
    layers.forEach((depth, name) => {
      if (!columns.has(depth)) columns.set(depth, [])
      columns.get(depth)!.push(name)
    })

    Array.from(columns.keys()).sort((a, b) => a - b).forEach((colIdx) => {
      const names = columns.get(colIdx)!
      names.forEach((name, rowIdx) => {
        const state = machine.states.find(s => s.name === name)!
        // colIdx = BFS depth (flow axis), rowIdx = position within the depth.
        const x = isVertical
          ? rowIdx * (NODE_WIDTH + SIBLING_GAP) + MARGIN
          : colIdx * (NODE_WIDTH + LAYER_GAP) + MARGIN
        const y = isVertical
          ? colIdx * (NODE_HEIGHT + LAYER_GAP) + MARGIN
          : rowIdx * (NODE_HEIGHT + SIBLING_GAP) + MARGIN
        nodePositions.set(name, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, state })
        maxColWidth = Math.max(maxColWidth, x + NODE_WIDTH + MARGIN)
        maxRowHeight = Math.max(maxRowHeight, y + NODE_HEIGHT + MARGIN)
      })
    })
  }

  // 2b. Compute group (parent state) bounding boxes from child node positions.
  const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
  const groupOrder: string[] = []
  const groupPositions: Map<string, NodePos[]> = new Map()
  machine.states.forEach((s) => {
    if (!s.parent) return
    const pos = nodePositions.get(s.name)
    if (!pos) return
    if (!groupPositions.has(s.parent)) {
      groupPositions.set(s.parent, [])
      groupOrder.push(s.parent)
    }
    groupPositions.get(s.parent)!.push(pos)
  })
  const groupBoxes = groupOrder.map((parent, i) => {
    const positions = groupPositions.get(parent)!
    const minX = Math.min(...positions.map(p => p.x)) - GROUP_PADDING
    const minY = Math.min(...positions.map(p => p.y)) - GROUP_PADDING - GROUP_LABEL_H
    const maxX = Math.max(...positions.map(p => p.x + p.width)) + GROUP_PADDING
    const maxY = Math.max(...positions.map(p => p.y + p.height)) + GROUP_PADDING
    return {
      parent,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }
  })

  // Ensure the SVG canvas is large enough to contain the group boxes and their labels.
  groupBoxes.forEach((g) => {
    maxColWidth = Math.max(maxColWidth, g.x + g.width + MARGIN)
    maxRowHeight = Math.max(maxRowHeight, g.y + g.height + MARGIN)
  })

  // 3. Render helpers
  const getEdgePath = (t: Transition, index: number, total: number) => {
    const from = nodePositions.get(t.from_state)
    const to = nodePositions.get(t.to_state)
    if (!from || !to) return null

    const offset = (index - (total - 1) / 2) * 20

    if (isVertical) {
      if (t.from_state === t.to_state) {
        // Self-transition loop, drawn off the right edge
        const x = from.x + from.width
        const y = from.y + from.height / 2
        const size = 30 + index * 10
        return `M ${x} ${y-10} C ${x+size} ${y-size}, ${x+size} ${y+size}, ${x} ${y+10}`
      }

      const startX = from.x + from.width / 2
      const startY = from.y + from.height
      const endX = to.x + to.width / 2
      const endY = to.y

      if (from.y < to.y) {
        // Forward transition (downward)
        const midY = (startY + endY) / 2
        return `M ${startX} ${startY} C ${startX + offset} ${midY}, ${endX + offset} ${midY}, ${endX} ${endY}`
      } else {
        // Backward or same row transition: route around the top
        const midY = Math.min(from.y, to.y) - LAYER_GAP / 2
        return `M ${startX} ${from.y} C ${startX + offset} ${midY}, ${endX + offset} ${midY}, ${endX} ${to.y}`
      }
    }

    if (t.from_state === t.to_state) {
      // Self-transition loop, drawn off the top edge
      const x = from.x + from.width / 2
      const y = from.y
      const size = 30 + index * 10
      return `M ${x-10} ${y} C ${x-size} ${y-size}, ${x+size} ${y-size}, ${x+10} ${y}`
    }

    const startX = from.x + from.width
    const startY = from.y + from.height / 2
    const endX = to.x
    const endY = to.y + to.height / 2

    if (from.x < to.x) {
      // Forward transition
      const midX = (startX + endX) / 2
      return `M ${startX} ${startY} C ${midX} ${startY + offset}, ${midX} ${endY + offset}, ${endX} ${endY}`
    } else {
      // Backward or same column transition
      const midX = Math.min(from.x, to.x) - LAYER_GAP / 2
      return `M ${from.x} ${startY} C ${midX} ${startY + offset}, ${midX} ${endY + offset}, ${to.x} ${endY}`
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-auto">
      {/* Layout direction toggle: switch between vertical (top→bottom) and horizontal (left→right) */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-gray-500">遷移方向</span>
        <button
          type="button"
          onClick={toggleVertical}
          aria-label={isVertical ? '横方向（左から右）に切り替え' : '縦方向（上から下）に切り替え'}
          title={isVertical ? '横方向（左から右）に切り替え' : '縦方向（上から下）に切り替え'}
          className="px-3 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          {isVertical ? '縦表示 ↓（横に切替）' : '横表示 →（縦に切替）'}
        </button>
      </div>
      <div className="min-w-max">
        <svg width={maxColWidth} height={maxRowHeight} viewBox={`0 0 ${maxColWidth} ${maxRowHeight}`} className="overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker id="arrowhead-traversed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" />
            </marker>
            <marker id="arrowhead-available" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" />
            </marker>
          </defs>

          {/* Group containers (parent / super states), drawn behind edges & nodes.
              Each box encloses exactly one parent's child states (swimlane layout). */}
          {groupBoxes.map((g) => (
            <g key={`group-${g.parent}`}>
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx="12"
                fill={g.color}
                fillOpacity="0.10"
                stroke={g.color}
                strokeOpacity="0.85"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              {/* Filled label chip so the parent name is clearly readable on the box. */}
              <rect
                x={g.x + 8}
                y={g.y + 3}
                width={Math.max(28, g.parent.length * 8 + 12)}
                height={GROUP_LABEL_H}
                rx="5"
                fill={g.color}
              />
              <text
                x={g.x + 14}
                y={g.y + 3 + GROUP_LABEL_H / 2}
                dominantBaseline="middle"
                className="text-[11px] font-semibold"
                fill="white"
              >
                {g.parent}
              </text>
            </g>
          ))}

          {/* Edges */}
          {machine.transitions.map((t) => {
            const isTraversed = visitedTransitionIds?.has(t.id)
            const isAvailable = t.from_state === currentState && !isTraversed
            
            const samePair = machine.transitions.filter(tr => tr.from_state === t.from_state && tr.to_state === t.to_state)
            const index = samePair.indexOf(t)
            const path = getEdgePath(t, index, samePair.length)
            
            if (!path) return null

            let stroke = '#9ca3af'
            let strokeWidth = 1.5
            let dashArray = ''
            let marker = 'url(#arrowhead)'

            if (isTraversed) {
              stroke = '#4f46e5'
              strokeWidth = 2.5
              marker = 'url(#arrowhead-traversed)'
            } else if (isAvailable) {
              stroke = '#16a34a'
              dashArray = '4 2'
              marker = 'url(#arrowhead-available)'
            }

            return (
              <g key={t.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  markerEnd={marker}
                />
                <text
                  className="text-[10px] font-mono"
                  fill={stroke}
                  textAnchor="middle"
                >
                  <textPath href={`#path-${t.id}`} startOffset="50%">
                    {/* textPath needs an actual path element with ID, but we can just use simple text positioning for now to avoid complexity */}
                  </textPath>
                </text>
                {/* Simplified label positioning */}
                {(() => {
                   const from = nodePositions.get(t.from_state)
                   const to = nodePositions.get(t.to_state)
                   if (!from || !to) return null
                   const labelOffset = (index - (samePair.length - 1) / 2) * 20
                   let lx, ly
                   if (isVertical) {
                     if (t.from_state === t.to_state) {
                       lx = from.x + from.width + 35 + index * 10
                       ly = from.y + from.height / 2
                     } else {
                       lx = (from.x + from.width / 2 + to.x + to.width / 2) / 2 + labelOffset
                       ly = (from.y + from.height + to.y) / 2
                     }
                   } else if (t.from_state === t.to_state) {
                     lx = from.x + from.width / 2
                     ly = from.y - 35 - index * 10
                   } else {
                     lx = (from.x + from.width + to.x) / 2
                     ly = (from.y + from.height / 2 + to.y + to.height / 2) / 2 + labelOffset - 5
                   }
                   return (
                     <text x={lx} y={ly} className="text-[10px] font-mono fill-gray-600 bg-white" textAnchor="middle">
                       {t.event}
                     </text>
                   )
                })()}
              </g>
            )
          })}

          {/* Nodes */}
          {Array.from(nodePositions.values()).map(({ x, y, width, height, state }) => {
            const isCurrent = state.name === currentState
            const isInitial = state.name === machine.initial_state
            const isTerminal = state.is_terminal

            let fill = 'white'
            let stroke = '#9ca3af'
            let strokeWidth = 1

            if (isCurrent) {
              fill = '#dbeafe'
              stroke = '#2563eb'
              strokeWidth = 3
            } else if (isInitial) {
              stroke = '#16a34a'
              strokeWidth = 2
            } else if (isTerminal) {
              stroke = '#dc2626'
              strokeWidth = 2
            }

            return (
              <g key={state.id}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="8"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className={`text-xs font-medium ${isCurrent ? 'fill-blue-800' : 'fill-gray-800'}`}
                >
                  {state.name}
                </text>
                {isInitial && (
                  <g transform={`translate(${x}, ${y - 12})`}>
                    <rect width="30" height="14" rx="4" fill="#16a34a" />
                    <text x="15" y="10" textAnchor="middle" fill="white" className="text-[8px] font-bold">初期</text>
                  </g>
                )}
                {isTerminal && (
                  <g transform={`translate(${x + width - 30}, ${y - 12})`}>
                    <rect width="30" height="14" rx="4" fill="#dc2626" />
                    <text x="15" y="10" textAnchor="middle" fill="white" className="text-[8px] font-bold">終端</text>
                  </g>
                )}
                {isTerminal && (
                   <rect
                    x={x + 2}
                    y={y + 2}
                    width={width - 4}
                    height={height - 4}
                    rx="6"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                   />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600 border-t pt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#dbeafe] border-2 border-[#2563eb] rounded-sm"></div>
          <span>現在</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-[#16a34a] rounded-sm"></div>
          <span>初期</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-[#dc2626] rounded-sm"></div>
          <span>終端</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-t-2 border-[#4f46e5]"></div>
          <span>遷移済み</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-t-2 border-dashed border-[#16a34a]"></div>
          <span>遷移可能</span>
        </div>
        {hasGroups && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-dashed border-[#6366f1] rounded-sm bg-[#6366f1]/10"></div>
            <span>親状態（グループ）</span>
          </div>
        )}
      </div>
    </div>
  )
}

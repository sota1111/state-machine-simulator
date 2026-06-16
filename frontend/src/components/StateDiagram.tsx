import type { StateMachine, State, Transition } from '../types'

interface Props {
  machine: StateMachine
  currentState?: string
  visitedTransitionIds?: Set<string>
}

interface NodePos {
  x: number
  y: number
  width: number
  height: number
  state: State
}

export default function StateDiagram({ machine, currentState, visitedTransitionIds }: Props) {
  const NODE_WIDTH = 140
  const NODE_HEIGHT = 44
  const COL_GAP = 80
  const ROW_GAP = 32

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
  const columns: Map<number, string[]> = new Map()
  layers.forEach((depth, name) => {
    if (!columns.has(depth)) columns.set(depth, [])
    columns.get(depth)!.push(name)
  })

  const nodePositions: Map<string, NodePos> = new Map()
  let maxColWidth = 0
  let maxRowHeight = 0

  Array.from(columns.keys()).sort((a, b) => a - b).forEach((colIdx) => {
    const names = columns.get(colIdx)!
    names.forEach((name, rowIdx) => {
      const state = machine.states.find(s => s.name === name)!
      const x = colIdx * (NODE_WIDTH + COL_GAP) + 20
      const y = rowIdx * (NODE_HEIGHT + ROW_GAP) + 20
      nodePositions.set(name, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, state })
      maxColWidth = Math.max(maxColWidth, x + NODE_WIDTH + 20)
      maxRowHeight = Math.max(maxRowHeight, y + NODE_HEIGHT + 20)
    })
  })

  // 3. Render helpers
  const getEdgePath = (t: Transition, index: number, total: number) => {
    const from = nodePositions.get(t.from_state)
    const to = nodePositions.get(t.to_state)
    if (!from || !to) return null

    if (t.from_state === t.to_state) {
      // Self-transition loop
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
      const offset = (index - (total - 1) / 2) * 20
      return `M ${startX} ${startY} C ${midX} ${startY + offset}, ${midX} ${endY + offset}, ${endX} ${endY}`
    } else {
      // Backward or same column transition
      const midX = Math.min(from.x, to.x) - COL_GAP / 2
      const offset = (index - (total - 1) / 2) * 20
      return `M ${from.x} ${startY} C ${midX} ${startY + offset}, ${midX} ${endY + offset}, ${to.x} ${endY}`
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-auto">
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
                   let lx, ly
                   if (t.from_state === t.to_state) {
                     lx = from.x + from.width / 2
                     ly = from.y - 35 - index * 10
                   } else {
                     lx = (from.x + from.width + to.x) / 2
                     ly = (from.y + from.height / 2 + to.y + to.height / 2) / 2 + (index - (samePair.length - 1) / 2) * 20 - 5
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
      </div>
    </div>
  )
}

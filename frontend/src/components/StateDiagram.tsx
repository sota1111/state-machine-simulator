import { useLayoutEffect, useRef, useState } from 'react'
import { useSimulationStore } from '../store/simulationStore'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import type { StateMachine, State, Transition } from '../types'
import {
  DELIVERABLE_STAGES,
  STAGE_COLOR,
  TONE_COLOR,
  stageCounts,
  type DeliverableAggregation,
  type DeliverableEntry,
  type DeliverableStage,
  type DeliverableTone,
} from '../utils/stateDeliverables'

interface Props {
  machine: StateMachine
  // Controlled orientation. When `isVertical` is provided, the diagram uses it and the
  // 遷移方向 toggle calls `onToggleVertical` instead of managing orientation internally.
  // When omitted, the component falls back to its own responsive default + internal toggle.
  isVertical?: boolean
  onToggleVertical?: () => void
  // Per-state / per-transition deliverable aggregation (SOT-1181). When provided, the diagram
  // renders per-node stage badges (案A), opens a node popover on click (案B), and offers a
  // stage-layer overlay toggle (案C). When omitted, the diagram behaves exactly as before.
  deliverables?: DeliverableAggregation
  // Badge / popover "jump to panel" callback: scrolls the matching 工程 panel into view.
  onStageNavigate?: (stage: DeliverableStage) => void
}

// Strongest-first tone precedence so a node/edge with mixed deliverables shows its most urgent one.
const TONE_RANK: Record<DeliverableTone, number> = { bad: 3, warn: 2, good: 1, info: 0 }
function dominantTone(entries: DeliverableEntry[]): DeliverableTone {
  return entries.reduce<DeliverableTone>((acc, e) => (TONE_RANK[e.tone] > TONE_RANK[acc] ? e.tone : acc), 'info')
}

interface NodePos {
  x: number
  y: number
  width: number
  height: number
  state: State
}

export default function StateDiagram({ machine, isVertical: controlledVertical, onToggleVertical, deliverables, onStageNavigate }: Props) {
  const { t, lang } = useI18n()
  const currentState = useSimulationStore(state => state.currentState) ?? machine.initial_state
  const visitedTransitionIdsArr = useSimulationStore(state => state.visitedTransitionIds)
  const visitedTransitionIds = new Set(visitedTransitionIdsArr)

  // Deliverable overlay state (SOT-1181). `overlayLayer` drives the 案C single-stage coloring;
  // `selectedNode` drives the 案B per-state popover. Both are inert when no deliverables prop.
  // 工程レイヤ切替 UI is hidden (SOT-1222); overlayLayer stays null so overlay branches are inert.
  const [overlayLayer] = useState<DeliverableStage | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const byState = deliverables?.byState
  const byTransition = deliverables?.byTransition
  // Only show overlay/badge UI when there is at least one deliverable to display.
  const hasDeliverables = !!deliverables && ((byState?.size ?? 0) > 0 || (byTransition?.size ?? 0) > 0)
  // Entries for a state/transition restricted to the active overlay layer (案C).
  const stateOverlay = (name: string): DeliverableEntry[] =>
    overlayLayer ? (byState?.get(name) ?? []).filter(e => e.stage === overlayLayer) : []
  const transitionOverlay = (id: string): DeliverableEntry[] =>
    overlayLayer ? (byTransition?.get(id) ?? []).filter(e => e.stage === overlayLayer) : []

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

  // Zoom control. The diagram renders at a natural pixel size (maxColWidth × maxRowHeight, see
  // below). We scale the rendered <svg> box while keeping the viewBox at natural size, so the
  // layout math is untouched and the surrounding `overflow-auto` container provides pan/scroll.
  // `scale === null` means "follow the fit-to-screen scale" (initial state, per SOT-948 the
  // initial view must show the whole diagram). Once the user zooms manually, `scale` holds an
  // explicit value and auto-fit stops.
  const ZOOM_MIN = 0.2
  const ZOOM_MAX = 2.5
  const ZOOM_STEP = 0.1
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
  const containerRef = useRef<HTMLDivElement>(null)
  const [manualScale, setManualScale] = useState<number | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const effectiveScale = manualScale ?? fitScale
  const zoomIn = () => setManualScale(clampZoom((manualScale ?? fitScale) + ZOOM_STEP))
  const zoomOut = () => setManualScale(clampZoom((manualScale ?? fitScale) - ZOOM_STEP))
  const zoomReset = () => setManualScale(null)

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

  // Fit-to-screen: measure the scroll container and compute the largest scale (never above 1)
  // that fits the whole diagram horizontally. Recomputed on container resize and whenever the
  // natural width changes (e.g. orientation toggle). Only width is used so tall diagrams stay
  // readable and scroll vertically.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      // Subtract the container's horizontal padding (p-4 = 16px each side) from the available width.
      const available = el.clientWidth - 32
      if (maxColWidth <= 0 || available <= 0) return
      setFitScale(clampZoom(Math.min(1, available / maxColWidth)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxColWidth, maxRowHeight])

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
    <div ref={containerRef} className="bg-surface rounded-lg border border-border shadow-card p-4 overflow-auto">
      {/* Controls: layout direction toggle + zoom (拡大縮小) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground-subtle">{t('diagram.direction')}</span>
        <button
          type="button"
          onClick={toggleVertical}
          aria-label={isVertical ? t('diagram.toHorizontal') : t('diagram.toVertical')}
          title={isVertical ? t('diagram.toHorizontal') : t('diagram.toVertical')}
          className="px-3 py-1 text-sm rounded border border-border text-foreground-muted hover:bg-surface-muted"
        >
          {isVertical ? t('diagram.showVertical') : t('diagram.showHorizontal')}
        </button>
        <span className="ml-2 text-xs text-foreground-subtle">{t('diagram.zoom')}</span>
        <button
          type="button"
          onClick={zoomOut}
          aria-label={t('diagram.zoomOutAria')}
          title={t('diagram.zoomOutAria')}
          className="px-3 py-1 text-sm rounded border border-border text-foreground-muted hover:bg-surface-muted"
        >
          {t('diagram.zoomOut')}
        </button>
        <button
          type="button"
          onClick={zoomIn}
          aria-label={t('diagram.zoomInAria')}
          title={t('diagram.zoomInAria')}
          className="px-3 py-1 text-sm rounded border border-border text-foreground-muted hover:bg-surface-muted"
        >
          {t('diagram.zoomIn')}
        </button>
        <button
          type="button"
          onClick={zoomReset}
          aria-label={t('diagram.fitAria')}
          title={t('diagram.fitAria')}
          className="px-3 py-1 text-sm rounded border border-border text-foreground-muted hover:bg-surface-muted"
        >
          {t('diagram.fit')}
        </button>
        <span className="text-xs text-foreground-subtle tabular-nums" aria-live="polite">
          {Math.round(effectiveScale * 100)}%
        </span>
      </div>

      {/* 工程レイヤ切替（案C）は非表示（SOT-1222）。overlayLayer は常に null のままで描画は従来どおり。 */}
      <div className="min-w-max">
        <svg width={maxColWidth * effectiveScale} height={maxRowHeight * effectiveScale} viewBox={`0 0 ${maxColWidth} ${maxRowHeight}`} className="overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker id="arrowhead-traversed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" />
            </marker>
            <marker id="arrowhead-available" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
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
                width={Math.max(28, sampleLabel(g.parent, lang).length * 8 + 12)}
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
                {sampleLabel(g.parent, lang)}
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
            let edgeOpacity = 1

            if (isTraversed) {
              stroke = '#4f46e5'
              strokeWidth = 2.5
              marker = 'url(#arrowhead-traversed)'
            } else if (isAvailable) {
              stroke = '#16a34a'
              dashArray = '4 2'
              marker = 'url(#arrowhead-available)'
            }

            // 案C overlay: when a 工程 layer is active, color edges that carry that stage's
            // deliverable by tone and dim the rest, so the selected 工程 stands out.
            if (overlayLayer) {
              const matched = transitionOverlay(t.id)
              if (matched.length > 0) {
                stroke = TONE_COLOR[dominantTone(matched)]
                strokeWidth = 2.5
                dashArray = ''
                marker = 'url(#arrowhead)'
              } else {
                stroke = '#d1d5db'
                strokeWidth = 1
                edgeOpacity = 0.3
              }
            }

            return (
              <g key={t.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeOpacity={edgeOpacity}
                  markerEnd={marker}
                  className={isAvailable && !overlayLayer ? 'sm-edge-available' : undefined}
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
                     <text x={lx} y={ly} className="text-[10px] font-mono fill-foreground-muted bg-surface" textAnchor="middle">
                       {sampleLabel(t.event, lang)}
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
            let nodeOpacity = 1

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

            // 案C overlay: recolor by the active 工程's deliverable tone; dim unrelated nodes.
            if (overlayLayer) {
              const matched = stateOverlay(state.name)
              if (matched.length > 0) {
                stroke = TONE_COLOR[dominantTone(matched)]
                strokeWidth = 3
                fill = '#fff'
              } else {
                stroke = '#d1d5db'
                strokeWidth = 1
                fill = 'white'
                nodeOpacity = 0.4
              }
            }

            // 案A badges: per-stage deliverable counts for this state.
            const counts = stageCounts(byState?.get(state.name))
            const badgeStages = hasDeliverables ? DELIVERABLE_STAGES.filter(s => counts[s] > 0) : []
            const isSelected = selectedNode === state.name

            return (
              <g key={state.id} opacity={nodeOpacity}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="8"
                  fill={fill}
                  stroke={isSelected ? '#1d4ed8' : stroke}
                  strokeWidth={isSelected ? Math.max(strokeWidth, 3) : strokeWidth}
                  className={isCurrent ? 'sm-node-current' : undefined}
                  style={hasDeliverables ? { cursor: 'pointer' } : undefined}
                  onClick={hasDeliverables ? () => setSelectedNode(prev => (prev === state.name ? null : state.name)) : undefined}
                />
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className={`text-xs font-medium ${isCurrent ? 'fill-blue-800' : 'fill-gray-800'}`}
                >
                  {sampleLabel(state.name, lang)}
                </text>
                {isInitial && (
                  <g transform={`translate(${x}, ${y - 12})`}>
                    <rect width="30" height="14" rx="4" fill="#16a34a" />
                    <text x="15" y="10" textAnchor="middle" fill="white" className="text-[8px] font-bold">{t('legend.initial')}</text>
                  </g>
                )}
                {isTerminal && (
                  <g transform={`translate(${x + width - 30}, ${y - 12})`}>
                    <rect width="30" height="14" rx="4" fill="#dc2626" />
                    <text x="15" y="10" textAnchor="middle" fill="white" className="text-[8px] font-bold">{t('legend.terminal')}</text>
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
                {/* 案A: per-stage deliverable badges, right-aligned along the node's bottom edge.
                    Click jumps to the matching 工程 panel. */}
                {badgeStages.map((stage, i) => {
                  const bw = 16
                  const bx = x + width - (i + 1) * (bw + 2)
                  const by = y + height - 8
                  return (
                    <g
                      key={`badge-${stage}`}
                      transform={`translate(${bx}, ${by})`}
                      style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); onStageNavigate?.(stage) }}
                    >
                      <title>{`${t(`deliverable.${stage}`)}: ${counts[stage]}`}</title>
                      <rect width={bw} height="14" rx="4" fill={STAGE_COLOR[stage]} stroke="#fff" strokeWidth="1" />
                      <text x={bw / 2} y="10" textAnchor="middle" fill="white" className="text-[8px] font-bold">
                        {counts[stage]}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* 案B: per-state popover aggregating every 工程's deliverables for the clicked node. */}
          {selectedNode && hasDeliverables && (() => {
            const pos = nodePositions.get(selectedNode)
            if (!pos) return null
            const entries = byState?.get(selectedNode) ?? []
            const PW = 260
            const PH = 150
            // Keep the popover inside the canvas.
            const px = Math.min(Math.max(pos.x, MARGIN), Math.max(MARGIN, maxColWidth - PW - MARGIN))
            const py = pos.y + pos.height + 8 + PH > maxRowHeight ? Math.max(MARGIN, pos.y - PH - 8) : pos.y + pos.height + 8
            return (
              <foreignObject x={px} y={py} width={PW} height={PH} style={{ overflow: 'visible' }}>
                <div className="bg-surface border border-border rounded-lg shadow-card p-3 text-xs" style={{ width: PW }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-foreground truncate">{sampleLabel(selectedNode, lang)}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      aria-label={t('deliverable.close')}
                      className="text-foreground-subtle hover:text-foreground px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-foreground-subtle mb-1.5">{t('deliverable.popoverTitle')}</p>
                  {entries.length === 0 ? (
                    <p className="text-foreground-subtle italic">{t('deliverable.none')}</p>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-auto">
                      {DELIVERABLE_STAGES.filter(s => entries.some(e => e.stage === s)).map(stage => (
                        <div key={stage}>
                          <button
                            type="button"
                            onClick={() => onStageNavigate?.(stage)}
                            className="flex items-center gap-1.5 font-medium text-foreground hover:underline"
                          >
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                            {t(`deliverable.${stage}`)}
                          </button>
                          <ul className="ml-3.5 mt-0.5 space-y-0.5">
                            {entries.filter(e => e.stage === stage).map((e, i) => (
                              <li key={i} style={{ color: TONE_COLOR[e.tone] }} className="truncate">
                                • {sampleLabel(e.text, lang)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </foreignObject>
            )
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-foreground-muted border-t pt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#dbeafe] border-2 border-[#2563eb] rounded-sm"></div>
          <span>{t('legend.current')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-[#16a34a] rounded-sm"></div>
          <span>{t('legend.initial')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-[#dc2626] rounded-sm"></div>
          <span>{t('legend.terminal')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-t-2 border-[#4f46e5]"></div>
          <span>{t('legend.traversed')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-t-2 border-dashed border-[#16a34a]"></div>
          <span>{t('legend.available')}</span>
        </div>
        {hasGroups && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-dashed border-[#6366f1] rounded-sm bg-[#6366f1]/10"></div>
            <span>{t('legend.group')}</span>
          </div>
        )}
      </div>

      {/* Deliverable stage legend (案A/B/C). */}
      {hasDeliverables && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-muted">
          <span className="font-medium">{t('deliverable.legend')}:</span>
          {DELIVERABLE_STAGES.map(stage => (
            <div key={stage} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: STAGE_COLOR[stage] }} />
              <span>{t(`deliverable.${stage}`)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

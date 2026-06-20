import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateModel } from '../api'
import type { StateMachine } from '../types'
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  fromStateMachine,
  addNode,
  moveNode,
  updateNode,
  removeNode,
  setInitial,
  addEdge,
  updateEdgeEvent,
  removeEdge,
  toStateMachineInput,
  type EditorModel,
  type EditorNode,
} from './stateEditorModel'

interface Props {
  machine: StateMachine
  onSaved?: () => void
}

interface DragState {
  nodeId: string
  dx: number
  dy: number
}

interface ConnectState {
  fromId: string
  x: number
  y: number
}

function nodeCenter(n: EditorNode) {
  return { cx: n.x + NODE_WIDTH / 2, cy: n.y + NODE_HEIGHT / 2 }
}

export default function StateDiagramEditor({ machine, onSaved }: Props) {
  const queryClient = useQueryClient()
  const svgRef = useRef<SVGSVGElement>(null)
  const [model, setModel] = useState<EditorModel>(() => fromStateMachine(machine))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [connect, setConnect] = useState<ConnectState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: () => updateModel(machine.id, toStateMachineInput(model)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model', machine.id] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['analysis', machine.id] })
      setError(null)
      onSaved?.()
    },
    onError: (err: { response?: { data?: { detail?: string } }; message: string }) => {
      setError(err.response?.data?.detail ?? err.message)
    },
  })

  const { width, height } = useMemo(() => {
    let w = 400
    let h = 300
    for (const n of model.nodes) {
      w = Math.max(w, n.x + NODE_WIDTH + 40)
      h = Math.max(h, n.y + NODE_HEIGHT + 40)
    }
    return { width: w, height: h }
  }, [model.nodes])

  const selectedNode = model.nodes.find(n => n.id === selectedNodeId) ?? null
  const selectedEdge = model.edges.find(e => e.id === selectedEdgeId) ?? null

  // Convert a pointer event into SVG-local coordinates.
  const toSvgPoint = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const nodeAtPoint = (x: number, y: number): EditorNode | null => {
    // Topmost (last drawn) node wins.
    for (let i = model.nodes.length - 1; i >= 0; i--) {
      const n = model.nodes[i]
      if (x >= n.x && x <= n.x + NODE_WIDTH && y >= n.y && y <= n.y + NODE_HEIGHT) return n
    }
    return null
  }

  const handleNodePointerDown = (e: React.PointerEvent, node: EditorNode) => {
    e.stopPropagation()
    const p = toSvgPoint(e)
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setDrag({ nodeId: node.id, dx: p.x - node.x, dy: p.y - node.y })
  }

  const handleHandlePointerDown = (e: React.PointerEvent, node: EditorNode) => {
    e.stopPropagation()
    const p = toSvgPoint(e)
    setConnect({ fromId: node.id, x: p.x, y: p.y })
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const p = toSvgPoint(e)
      setModel(m => moveNode(m, drag.nodeId, Math.max(0, p.x - drag.dx), Math.max(0, p.y - drag.dy)))
    } else if (connect) {
      const p = toSvgPoint(e)
      setConnect({ ...connect, x: p.x, y: p.y })
    }
  }

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (connect) {
      const p = toSvgPoint(e)
      const target = nodeAtPoint(p.x, p.y)
      if (target) {
        setModel(m => addEdge(m, connect.fromId, target.id, ''))
      }
      setConnect(null)
    }
    setDrag(null)
  }

  const handleAddNode = () => {
    setModel(m => addNode(m, 40, 40))
  }

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return
    setModel(m => removeNode(m, selectedNodeId))
    setSelectedNodeId(null)
  }

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return
    setModel(m => removeEdge(m, selectedEdgeId))
    setSelectedEdgeId(null)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAddNode}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          + 状態を追加
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? '保存中...' : '保存'}
        </button>
        <span className="text-xs text-gray-500">
          ノードをドラッグで移動 / 右側の●から別ノードへドラッグで遷移作成
        </span>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="overflow-auto border border-gray-100 rounded flex-1">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="touch-none select-none"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerLeave={handleSvgPointerUp}
            onPointerDown={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
          >
            <defs>
              <marker id="edit-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
              <marker id="edit-arrow-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
              </marker>
            </defs>

            {/* Edges */}
            {model.edges.map(edge => {
              const from = model.nodes.find(n => n.id === edge.from)
              const to = model.nodes.find(n => n.id === edge.to)
              if (!from || !to) return null
              const a = nodeCenter(from)
              const b = nodeCenter(to)
              const isSel = edge.id === selectedEdgeId
              const isSelf = edge.from === edge.to
              const mx = (a.cx + b.cx) / 2
              const my = (a.cy + b.cy) / 2
              const path = isSelf
                ? `M ${from.x + NODE_WIDTH / 2} ${from.y} C ${from.x + NODE_WIDTH / 2 - 60} ${from.y - 70}, ${from.x + NODE_WIDTH / 2 + 60} ${from.y - 70}, ${from.x + NODE_WIDTH / 2 + 10} ${from.y}`
                : `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`
              return (
                <g key={edge.id} onPointerDown={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null) }}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isSel ? '#2563eb' : '#6b7280'}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    markerEnd={isSel ? 'url(#edit-arrow-sel)' : 'url(#edit-arrow)'}
                  />
                  {/* Invisible wide hit area for easier selection */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth={12} className="cursor-pointer" />
                  <text
                    x={isSelf ? from.x + NODE_WIDTH / 2 : mx}
                    y={isSelf ? from.y - 76 : my - 6}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-gray-700"
                  >
                    {edge.event || '(イベント未設定)'}
                  </text>
                </g>
              )
            })}

            {/* In-progress connection line */}
            {connect && (() => {
              const from = model.nodes.find(n => n.id === connect.fromId)
              if (!from) return null
              const a = nodeCenter(from)
              return (
                <line
                  x1={a.cx}
                  y1={a.cy}
                  x2={connect.x}
                  y2={connect.y}
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )
            })()}

            {/* Nodes */}
            {model.nodes.map(node => {
              const isSel = node.id === selectedNodeId
              const isInitial = node.id === model.initialId
              return (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="8"
                    fill={isSel ? '#eff6ff' : 'white'}
                    stroke={isSel ? '#2563eb' : isInitial ? '#16a34a' : node.is_terminal ? '#dc2626' : '#9ca3af'}
                    strokeWidth={isSel ? 3 : isInitial || node.is_terminal ? 2 : 1}
                    className="cursor-move"
                    data-testid={`node-${node.name}`}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                  />
                  <text
                    x={node.x + NODE_WIDTH / 2}
                    y={node.y + NODE_HEIGHT / 2}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    className="text-xs font-medium fill-gray-800 pointer-events-none"
                  >
                    {node.name || '(無名)'}
                  </text>
                  {isInitial && (
                    <text x={node.x + 6} y={node.y - 4} className="text-[9px] font-bold fill-green-700 pointer-events-none">初期</text>
                  )}
                  {node.is_terminal && (
                    <text x={node.x + NODE_WIDTH - 30} y={node.y - 4} className="text-[9px] font-bold fill-red-700 pointer-events-none">終端</text>
                  )}
                  {/* Connection handle */}
                  <circle
                    cx={node.x + NODE_WIDTH}
                    cy={node.y + NODE_HEIGHT / 2}
                    r="6"
                    fill="#16a34a"
                    className="cursor-crosshair"
                    data-testid={`handle-${node.name}`}
                    onPointerDown={(e) => handleHandlePointerDown(e, node)}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Inspector panel */}
        <div className="w-full lg:w-72 shrink-0 space-y-3">
          {selectedNode && (
            <div className="border border-gray-200 rounded p-3 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">状態を編集</h4>
              <label className="block text-xs text-gray-500">名前</label>
              <input
                aria-label="状態名"
                type="text"
                value={selectedNode.name}
                onChange={(e) => setModel(m => updateNode(m, selectedNode.id, { name: e.target.value }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <label className="block text-xs text-gray-500">説明</label>
              <input
                aria-label="状態の説明"
                type="text"
                value={selectedNode.description}
                onChange={(e) => setModel(m => updateNode(m, selectedNode.id, { description: e.target.value }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedNode.is_terminal}
                  onChange={(e) => setModel(m => updateNode(m, selectedNode.id, { is_terminal: e.target.checked }))}
                />
                終端状態
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModel(m => setInitial(m, selectedNode.id))}
                  disabled={selectedNode.id === model.initialId}
                  className="px-2 py-1 text-xs border border-green-500 text-green-700 rounded hover:bg-green-50 disabled:opacity-40"
                >
                  初期状態に設定
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedNode}
                  className="px-2 py-1 text-xs border border-red-400 text-red-600 rounded hover:bg-red-50"
                >
                  状態を削除
                </button>
              </div>
            </div>
          )}

          {selectedEdge && (
            <div className="border border-gray-200 rounded p-3 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">遷移を編集</h4>
              <label className="block text-xs text-gray-500">イベント名</label>
              <input
                aria-label="イベント名"
                type="text"
                value={selectedEdge.event}
                onChange={(e) => setModel(m => updateEdgeEvent(m, selectedEdge.id, e.target.value))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={handleDeleteSelectedEdge}
                className="px-2 py-1 text-xs border border-red-400 text-red-600 rounded hover:bg-red-50"
              >
                遷移を削除
              </button>
            </div>
          )}

          {!selectedNode && !selectedEdge && (
            <p className="text-xs text-gray-400">
              ノードまたは遷移を選択すると、ここで編集できます。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

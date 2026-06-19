import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getModel, getAnalysis } from '../api'
import StateDiagram from '../components/StateDiagram'
import SimulationPanel from '../components/SimulationPanel'
import AnalysisPanel from '../components/AnalysisPanel'
import { useSimulationStore } from '../store/simulationStore'

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentStateFromStore = useSimulationStore(state => state.currentState)
  const initForMachine = useSimulationStore(state => state.initForMachine)

  const { data: machine, isLoading: machineLoading } = useQuery({
    queryKey: ['model', id],
    queryFn: () => getModel(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (machine) {
      initForMachine(machine.initial_state)
    }
  }, [machine, initForMachine])

  const currentState = currentStateFromStore ?? machine?.initial_state

  const { data: analysis } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysis(id!),
    enabled: !!id,
  })

  const handleExport = () => {
    if (!machine) return
    const data = {
      name: machine.name,
      description: machine.description,
      initial_state: machine.initial_state,
      states: machine.states.map(s => ({ name: s.name, description: s.description, is_terminal: s.is_terminal })),
      transitions: machine.transitions.map(t => ({ from_state: t.from_state, to_state: t.to_state, event: t.event })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${machine.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (machineLoading) return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  if (!machine) return <div className="text-center py-12 text-red-500">モデルが見つかりません</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
          ← 一覧に戻る
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{machine.name}</h1>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          JSON エクスポート
        </button>
      </div>

      {machine.description && (
        <p className="text-gray-600">{machine.description}</p>
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-700">状態遷移図</h2>
          <StateDiagram
            machine={machine}
          />
        </div>

        <div className="space-y-4">
          <SimulationPanel
            machine={machine}
          />
          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">状態一覧</h3>
          <div className="space-y-2">
            {machine.states.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className={`font-medium ${s.name === (currentState ?? machine.initial_state) ? 'text-blue-600' : 'text-gray-800'}`}>
                  {s.name}{s.name === machine.initial_state ? ' (初期)' : ''}{s.is_terminal ? ' (終端)' : ''}
                </span>
                {s.description && <span className="text-gray-500 text-xs">{s.description}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">遷移一覧</h3>
          <div className="space-y-2">
            {machine.transitions.map(t => (
              <div key={t.id} className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                {t.from_state} --[{t.event}]--&gt; {t.to_state}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

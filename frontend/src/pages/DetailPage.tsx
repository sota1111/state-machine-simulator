import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getModel, getAnalysis } from '../api'
import StateDiagram from '../components/StateDiagram'
import StateDiagramEditor from '../components/StateDiagramEditor'
import SimulationPanel from '../components/SimulationPanel'
import AnalysisPanel from '../components/AnalysisPanel'
import CoveragePanel from '../components/CoveragePanel'
import ReviewComments from '../components/ReviewComments'
import { useSimulationStore } from '../store/simulationStore'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import { buildProcedureSteps, toPlantUml } from '../utils/flow'

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const currentStateFromStore = useSimulationStore(state => state.currentState)
  const initForMachine = useSimulationStore(state => state.initForMachine)

  // Transition direction is owned here (lifted out of StateDiagram) so it can also drive
  // the page layout: on PC + vertical direction, the event buttons move beside the diagram.
  // null = follow the default (vertical on every screen size); the user can override it.
  const isPc = useMediaQuery('(min-width: 768px)')
  const [orientationOverride, setOrientationOverride] = useState<boolean | null>(null)
  const isVertical = orientationOverride ?? true

  const { data: machine, isLoading: machineLoading } = useQuery({
    queryKey: ['model', id],
    queryFn: () => getModel(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (machine) {
      initForMachine(machine.initial_state, t('sim.initialLog'))
    }
  }, [machine, initForMachine, t])

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
    downloadFile(JSON.stringify(data, null, 2), 'application/json', `${machine.name.replace(/\s+/g, '_')}.json`)
  }

  const handleExportPuml = () => {
    if (!machine) return
    downloadFile(toPlantUml(machine), 'text/plain', `${machine.name.replace(/\s+/g, '_')}.puml`)
  }

  const downloadFile = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (machineLoading) return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
  if (!machine) return <div className="text-center py-12 text-red-500">{t('detail.notFound')}</div>

  // Move the event buttons beside the diagram only on PC + vertical direction, and not while editing
  // (the editor needs full width).
  const sideBySide = isPc && isVertical && !isEditing
  const procedureSteps = buildProcedureSteps(machine)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
          {t('detail.back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{sampleLabel(machine.name, lang)}</h1>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          {t('detail.exportJson')}
        </button>
        <button
          onClick={handleExportPuml}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          {t('detail.exportPuml')}
        </button>
      </div>

      {machine.description && (
        <p className="text-gray-600">{machine.description}</p>
      )}

      {/* On PC with vertical transition direction (and not editing), the diagram is tall and
          narrow, so the event buttons sit to its RIGHT. Otherwise they stack below. */}
      <div className={sideBySide ? 'flex flex-row gap-6 items-start' : 'space-y-6'}>
        <div className={`space-y-4 ${sideBySide ? 'flex-1 min-w-0' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">{t('detail.diagram')}</h2>
            <button
              onClick={() => setIsEditing(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isEditing ? t('detail.endEdit') : t('detail.editDiagram')}
            </button>
          </div>
          {isEditing ? (
            <StateDiagramEditor
              machine={machine}
              onSaved={() => setIsEditing(false)}
            />
          ) : (
            <StateDiagram
              machine={machine}
              isVertical={isVertical}
              onToggleVertical={() => setOrientationOverride(!isVertical)}
            />
          )}
        </div>

        <div className={`space-y-4 ${sideBySide ? 'w-80 shrink-0' : ''}`}>
          <SimulationPanel
            machine={machine}
          />
          {analysis && <AnalysisPanel analysis={analysis} />}
          <CoveragePanel machine={machine} />
          <ReviewComments machineId={machine.id} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">{t('detail.statesList')}</h3>
          <div className="space-y-2">
            {machine.states.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className={`font-medium ${s.name === (currentState ?? machine.initial_state) ? 'text-blue-600' : 'text-gray-800'}`}>
                  {sampleLabel(s.name, lang)}{s.name === machine.initial_state ? ` (${t('detail.initialTag')})` : ''}{s.is_terminal ? ` (${t('detail.terminalTag')})` : ''}
                </span>
                {s.description && <span className="text-gray-500 text-xs">{s.description}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">{t('detail.transitionsList')}</h3>
          <div className="space-y-2">
            {machine.transitions.map(t => (
              <div key={t.id} className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                {sampleLabel(t.from_state, lang)} --[{sampleLabel(t.event, lang)}]--&gt; {sampleLabel(t.to_state, lang)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-700 mb-3">{t('detail.procedure')}</h3>
        {procedureSteps.length === 0 ? (
          <p className="text-sm text-gray-400">{t('detail.procedureEmpty')}</p>
        ) : (
          <ol className="space-y-2">
            {procedureSteps.map((step, i) => (
              <li key={`${step.from_state}-${step.event}-${step.to_state}-${i}`} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-gray-800">
                  <span className="font-medium">{sampleLabel(step.from_state, lang)}</span>
                  <span className="mx-1.5 text-gray-400">—[{sampleLabel(step.event, lang)}]→</span>
                  <span className="font-medium">{sampleLabel(step.to_state, lang)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

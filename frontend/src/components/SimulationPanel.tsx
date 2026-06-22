import { useMutation, useQueryClient } from '@tanstack/react-query'
import { simulateStep } from '../api'
import { useSimulationStore } from '../store/simulationStore'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import type { StateMachine } from '../types'

interface Props {
  machine: StateMachine
}

export default function SimulationPanel({ machine }: Props) {
  const { t, lang } = useI18n()
  const currentState = useSimulationStore(state => state.currentState) ?? machine.initial_state
  const log = useSimulationStore(state => state.log)
  const addStep = useSimulationStore(state => state.addStep)
  const reset = useSimulationStore(state => state.reset)
  const addLog = useSimulationStore(state => state.addLog)
  const queryClient = useQueryClient()

  const availableEvents = machine.transitions
    .filter(t => t.from_state === currentState)
    .map(t => t.event)

  const mutation = useMutation({
    mutationFn: (event: string) => simulateStep(machine.id, { current_state: currentState, event }),
    onSuccess: (data, event) => {
      if (data.success && data.next_state) {
        const t = machine.transitions.find(tr => tr.from_state === currentState && tr.event === event)
        if (t) {
          addStep(t.id, currentState, event, data.next_state)
        } else {
          // Should not happen if transitions are consistent
          addLog(`${currentState} --[${event}]--> ${data.next_state}`)
        }
        queryClient.invalidateQueries({ queryKey: ['history', machine.id] })
      } else {
        addLog(`${t('sim.errorPrefix')}: ${data.message}`)
      }
    }
  })

  const handleReset = () => {
    reset(machine.initial_state, t('sim.resetLog'))
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-4 space-y-4">
      <h3 className="font-semibold text-foreground">{t('sim.title')}</h3>

      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground-subtle">{t('sim.currentState')}</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          {sampleLabel(currentState, lang)}
        </span>
      </div>

      <div>
        <p className="text-sm text-foreground-subtle mb-2">{t('sim.availableEvents')}</p>
        {availableEvents.length === 0 ? (
          <p className="text-sm text-foreground-subtle italic">{t('sim.terminalNoEvents')}</p>
        ) : (
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
            {availableEvents.map(event => (
              <button
                key={event}
                onClick={() => mutation.mutate(event)}
                disabled={mutation.isPending}
                className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {sampleLabel(event, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleReset}
        className="px-3 py-1.5 border border-border text-foreground-muted rounded-md text-sm hover:bg-surface-muted transition-colors"
      >
        {t('sim.reset')}
      </button>

      <div className="bg-surface-muted rounded p-3 max-h-40 overflow-y-auto">
        <p className="text-xs text-foreground-subtle mb-1">{t('sim.log')}</p>
        {log.map((entry, i) => (
          <p key={i} className="text-xs text-foreground-muted font-mono">{entry}</p>
        ))}
      </div>
    </div>
  )
}

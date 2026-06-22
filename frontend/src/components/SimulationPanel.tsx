import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { simulateStep } from '../api'
import { useSimulationStore } from '../store/simulationStore'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import type { StateMachine } from '../types'
import { runSequence, parseSequence } from '../utils/simulationRun'

interface Props {
  machine: StateMachine
}

const SPEED_OPTIONS = [
  { label: '0.5x', ms: 1600 },
  { label: '1x', ms: 800 },
  { label: '2x', ms: 400 },
]

export default function SimulationPanel({ machine }: Props) {
  const { t, lang } = useI18n()
  const currentState = useSimulationStore(state => state.currentState) ?? machine.initial_state
  const log = useSimulationStore(state => state.log)
  const addStep = useSimulationStore(state => state.addStep)
  const reset = useSimulationStore(state => state.reset)
  const addLog = useSimulationStore(state => state.addLog)
  const pendingSequence = useSimulationStore(state => state.pendingSequence)
  const setPendingSequence = useSimulationStore(state => state.setPendingSequence)
  const queryClient = useQueryClient()

  // --- Auto-play (sequence playback) state ---
  const [sequenceText, setSequenceText] = useState('')
  const [speedMs, setSpeedMs] = useState(SPEED_OPTIONS[1].ms)
  const [isPlaying, setIsPlaying] = useState(false)
  // Resolved steps for the current sequence and the cursor of the next step to apply.
  const playRef = useRef<{ steps: ReturnType<typeof runSequence>['steps']; index: number; reason: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest speed, read inside the timer loop without re-arming via deps.
  const speedRef = useRef(speedMs)
  speedRef.current = speedMs

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

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleReset = () => {
    stopTimer()
    setIsPlaying(false)
    playRef.current = null
    reset(machine.initial_state, t('sim.resetLog'))
  }

  // Resolve and prepare the run for the current sequence text, resetting to the initial state.
  const buildRun = () => {
    const events = parseSequence(sequenceText)
    if (events.length === 0) return null
    reset(machine.initial_state, t('sim.resetLog'))
    const result = runSequence(machine, events)
    playRef.current = { steps: result.steps, index: 0, reason: result.reason }
    return playRef.current
  }

  // Append the terminating reason line once a run is exhausted.
  const logFinish = (reason: string) => {
    if (reason === 'undefined_event') addLog(t('sim.stoppedUndefined'))
    else if (reason === 'terminal') addLog(t('sim.stoppedTerminal'))
    else addLog(t('sim.done'))
  }

  // Apply one step. Returns false when there is nothing left to apply.
  const applyNextStep = (): boolean => {
    let run = playRef.current
    if (!run) run = buildRun()
    if (!run) return false
    if (run.index >= run.steps.length) {
      logFinish(run.reason)
      return false
    }
    const step = run.steps[run.index]
    addStep(step.transition_id, step.from_state, step.event, step.to_state)
    run.index += 1
    return true
  }

  const handleStep = () => {
    if (isPlaying) return
    applyNextStep()
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      stopTimer()
      setIsPlaying(false)
      return
    }
    if (!playRef.current || playRef.current.index >= playRef.current.steps.length) {
      buildRun()
    }
    setIsPlaying(true)
  }

  // Self-rescheduling playback loop, armed only when isPlaying flips on.
  useEffect(() => {
    if (!isPlaying) return
    const tick = () => {
      const more = applyNextStep()
      if (more) {
        timerRef.current = setTimeout(tick, speedRef.current)
      } else {
        setIsPlaying(false)
      }
    }
    timerRef.current = setTimeout(tick, speedRef.current)
    return stopTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Consume a sequence pushed in from another panel (test-case "run in simulator", SOT-1103).
  useEffect(() => {
    if (pendingSequence && pendingSequence.length > 0) {
      stopTimer()
      setIsPlaying(false)
      playRef.current = null
      setSequenceText(pendingSequence.join(', '))
      setPendingSequence(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSequence])

  // Clean up the timer on unmount.
  useEffect(() => stopTimer, [])

  const hasSequence = parseSequence(sequenceText).length > 0

  return (
    <div className="bg-surface rounded-lg border border-border p-4 space-y-4">
      <h3 className="font-semibold text-foreground">{t('sim.title')}</h3>

      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground-subtle">{t('sim.currentState')}</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium transition-all duration-300">
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
                disabled={mutation.isPending || isPlaying}
                className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {sampleLabel(event, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sequence playback (SOT-1100, 2-A) */}
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-sm font-medium text-foreground-muted">{t('sim.autoplayTitle')}</p>
        <label className="block text-xs text-foreground-subtle">{t('sim.sequence')}</label>
        <textarea
          value={sequenceText}
          onChange={e => {
            setSequenceText(e.target.value)
            playRef.current = null
          }}
          placeholder={t('sim.sequencePlaceholder')}
          rows={2}
          className="w-full text-sm font-mono border border-border rounded-md p-2 bg-surface text-foreground"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!hasSequence}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPlaying ? t('sim.pause') : t('sim.play')}
          </button>
          <button
            onClick={handleStep}
            disabled={isPlaying || !hasSequence}
            className="px-3 py-1.5 border border-border text-foreground-muted rounded-md text-sm hover:bg-surface-muted disabled:opacity-50 transition-colors"
          >
            {t('sim.step')}
          </button>
          <span className="text-xs text-foreground-subtle">{t('sim.speed')}</span>
          <select
            value={speedMs}
            onChange={e => setSpeedMs(Number(e.target.value))}
            className="text-sm border border-border rounded-md px-2 py-1 bg-surface text-foreground"
          >
            {SPEED_OPTIONS.map(o => (
              <option key={o.label} value={o.ms}>{o.label}</option>
            ))}
          </select>
        </div>
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

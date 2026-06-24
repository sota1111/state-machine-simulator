import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { StateMachine, TestCase, TestCaseCategory } from '../types'
import { generateTestCases } from '../api'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import { generateCoveragePaths, type CoverageRun } from '../utils/coveragePaths'
import { useSimulationStore } from '../store/simulationStore'

interface Props {
  machine: StateMachine
  // Lift generated cases up so the state diagram can overlay covered states (SOT-1181).
  onCases?: (cases: TestCase[]) => void
}

const CATEGORY_LABEL: Record<TestCaseCategory, MessageKey> = {
  normal: 'testcase.cat.normal',
  abnormal: 'testcase.cat.abnormal',
  cancel: 'testcase.cat.cancel',
  timeout: 'testcase.cat.timeout',
}

const CATEGORY_STYLE: Record<TestCaseCategory, string> = {
  normal: 'bg-green-100 text-green-700',
  abnormal: 'bg-red-100 text-red-700',
  cancel: 'bg-amber-100 text-amber-800',
  timeout: 'bg-indigo-100 text-indigo-700',
}

const CATEGORY_ORDER: TestCaseCategory[] = ['normal', 'abnormal', 'cancel', 'timeout']

// Auto-generated test cases panel (SOT-1097). Generates normal / abnormal / cancel /
// timeout cases from the machine via backend /api/testcases.
export default function TestCasesPanel({ machine, onCases }: Props) {
  const { t } = useI18n()
  const setPendingSequence = useSimulationStore(state => state.setPendingSequence)
  const [coverage, setCoverage] = useState<CoverageRun | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      generateTestCases({
        initial_state: machine.initial_state,
        states: machine.states.map(s => ({ name: s.name, description: s.description ?? '', is_terminal: s.is_terminal })),
        transitions: machine.transitions.map(tr => ({ from_state: tr.from_state, to_state: tr.to_state, event: tr.event })),
      }),
    onSuccess: data => onCases?.(data.cases),
  })

  const cases: TestCase[] = mutation.data?.cases ?? []

  // Feed an event sequence into the simulator's sequence playback (2-A).
  const runInSimulator = (events: string[]) => {
    if (events.length > 0) setPendingSequence(events)
  }

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t('testcase.title')}</h3>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? t('testcase.generating') : t('testcase.generate')}
        </button>
      </div>

      <p className="text-xs text-foreground-subtle">{t('testcase.hint')}</p>

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {t('testcase.failed')}
        </div>
      )}

      {cases.length > 0 && (
        <div className="space-y-2">
          {CATEGORY_ORDER.flatMap(cat => cases.filter(c => c.category === cat)).map((c, i) => (
            <div key={i} className="rounded border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CATEGORY_STYLE[c.category]}`}>
                  {t(CATEGORY_LABEL[c.category])}
                </span>
                <span className="text-sm font-medium text-foreground">{c.title}</span>
              </div>
              {c.steps.length > 0 && (
                <ol className="space-y-1">
                  {c.steps.map((s, j) => (
                    <li key={j} className="text-xs font-mono text-foreground-muted bg-surface-muted px-2 py-1 rounded">
                      {j + 1}. {s.from_state} --[{s.event}]--&gt; {s.to_state}
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-sm text-foreground-muted">
                <span className="font-medium">{t('testcase.expected')}: </span>{c.expected}
              </p>
              {c.steps.length > 0 && (
                <button
                  onClick={() => runInSimulator(c.steps.map(s => s.event))}
                  className="px-2.5 py-1 border border-border text-foreground-muted rounded text-xs hover:bg-surface-muted transition-colors"
                >
                  ▶ {t('testcase.runInSim')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-transition coverage generation (SOT-1103, 2-D). */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground-muted">{t('testcase.coverageTitle')}</p>
          <button
            onClick={() => setCoverage(generateCoveragePaths(machine))}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('testcase.generateCoverage')}
          </button>
        </div>
        {coverage && (
          coverage.totalReachableTransitions === 0 ? (
            <p className="text-sm text-foreground-subtle italic">{t('testcase.coverageEmpty')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-foreground-muted">
                {t('testcase.coverageRate')}: {coverage.coveredTransitions}/{coverage.totalReachableTransitions}
                {' '}({Math.round((coverage.coveredTransitions / coverage.totalReachableTransitions) * 100)}%)
              </p>
              {coverage.sequences.map((seq, i) => (
                <div key={i} className="rounded border border-border p-2 space-y-1">
                  <p className="text-xs font-mono text-foreground-muted break-words">{seq.join(' → ')}</p>
                  <button
                    onClick={() => runInSimulator(seq)}
                    className="px-2.5 py-1 border border-border text-foreground-muted rounded text-xs hover:bg-surface-muted transition-colors"
                  >
                    ▶ {t('testcase.runInSim')}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

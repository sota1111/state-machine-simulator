import { useMutation } from '@tanstack/react-query'
import type { StateMachine, ReviewFinding, ReviewFindingType, ReviewSeverity } from '../types'
import { reviewMachine } from '../api'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'

interface Props {
  machine: StateMachine
  // Original natural-language spec, used to enrich AI-assisted findings (optional).
  specText?: string
}

// i18n label key for each finding type.
const TYPE_LABEL: Record<ReviewFindingType, MessageKey> = {
  unreachable_state: 'review.type.unreachable_state',
  undefined_event: 'review.type.undefined_event',
  non_terminating: 'review.type.non_terminating',
  missing_error_handling: 'review.type.missing_error_handling',
  missing_cancel: 'review.type.missing_cancel',
  missing_timeout: 'review.type.missing_timeout',
  ambiguous_condition: 'review.type.ambiguous_condition',
}

const SEVERITY_STYLE: Record<ReviewSeverity, string> = {
  error: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
}

// Design-review panel (SOT-1096). Runs backend /api/review over the given machine
// and lists detected spec problems with a reason and a repair suggestion each.
export default function ReviewPanel({ machine, specText }: Props) {
  const { t } = useI18n()

  const mutation = useMutation({
    mutationFn: () =>
      reviewMachine({
        initial_state: machine.initial_state,
        states: machine.states.map(s => ({ name: s.name, description: s.description ?? '', is_terminal: s.is_terminal })),
        transitions: machine.transitions.map(tr => ({ from_state: tr.from_state, to_state: tr.to_state, event: tr.event })),
        spec_text: specText,
      }),
  })

  const findings: ReviewFinding[] = mutation.data?.findings ?? []
  const hasRun = mutation.isSuccess

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t('review.title')}</h3>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? t('review.running') : t('review.run')}
        </button>
      </div>

      <p className="text-xs text-foreground-subtle">{t('review.hint')}</p>

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {t('review.failed')}
        </div>
      )}

      {hasRun && findings.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
          ✓ {t('review.clean')}
        </div>
      )}

      {findings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground-muted">
              ⚠ {findings.length} {t('review.findingsLabel')}
            </p>
            {mutation.data?.ai_used && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">{t('review.aiUsed')}</span>
            )}
          </div>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li key={i} className={`rounded border p-3 space-y-1 ${SEVERITY_STYLE[f.severity]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/60">{t(TYPE_LABEL[f.type])}</span>
                  {f.target && <span className="text-xs font-mono opacity-80">{f.target}</span>}
                </div>
                <p className="text-sm">
                  <span className="font-medium">{t('review.reason')}: </span>{f.reason}
                </p>
                {f.suggestion && (
                  <p className="text-sm">
                    <span className="font-medium">{t('review.suggestion')}: </span>{f.suggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

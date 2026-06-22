import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { StateMachine } from '../types'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import { analyzeCoverage } from '../utils/coverageAnalysis'
import { buildFixes, type CoverageFixKind, type FixSuggestion } from '../utils/coverageFix'
import { updateModel } from '../api'
import type { MessageKey } from '../i18n/messages'

interface Props {
  machine: StateMachine
}

// i18n keys for each fixable finding kind (reason = なぜ問題か, suggestion = 修正案).
const FIX_REASON: Record<CoverageFixKind, MessageKey> = {
  deadlock: 'coverage.fix.deadlockReason',
  duplicate: 'coverage.fix.duplicateReason',
  undefined_target: 'coverage.fix.undefinedReason',
}
const FIX_SUGGESTION: Record<CoverageFixKind, MessageKey> = {
  deadlock: 'coverage.fix.deadlockSuggestion',
  duplicate: 'coverage.fix.duplicateSuggestion',
  undefined_target: 'coverage.fix.undefinedSuggestion',
}

// Coverage / sanity-check panel (SOT-1036). Computes structural gaps entirely on the
// frontend from the StateMachine model: unreachable steps, deadlocks, undefined and
// duplicate actions. Complements AnalysisPanel (which reads the backend AnalysisResult).
export default function CoveragePanel({ machine }: Props) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const result = analyzeCoverage(machine)
  const fixes = buildFixes(machine)

  const fixMutation = useMutation({
    mutationFn: (fix: FixSuggestion) => updateModel(machine.id, fix.build(machine)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model', machine.id] })
      queryClient.invalidateQueries({ queryKey: ['analysis', machine.id] })
    },
  })

  const issueCount =
    result.unreachableStates.length +
    result.deadlockStates.length +
    result.undefinedTransitions.length +
    result.duplicateTransitions.length
  const clean = issueCount === 0

  const sections: { titleKey: MessageKey; items: string[] }[] = [
    {
      titleKey: 'coverage.unreachable',
      items: result.unreachableStates.map(s => sampleLabel(s.name, lang)),
    },
    {
      titleKey: 'coverage.deadlock',
      items: result.deadlockStates.map(s => sampleLabel(s.name, lang)),
    },
    {
      titleKey: 'coverage.undefined',
      items: result.undefinedTransitions.map(
        tr => `${sampleLabel(tr.from_state, lang)} --[${sampleLabel(tr.event, lang)}]--> ${sampleLabel(tr.to_state, lang)}`,
      ),
    },
    {
      titleKey: 'coverage.duplicate',
      items: result.duplicateTransitions.map(
        tr => `${sampleLabel(tr.from_state, lang)} --[${sampleLabel(tr.event, lang)}]--> ${sampleLabel(tr.to_state, lang)}`,
      ),
    },
  ]

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card p-4 space-y-4 nums">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t('coverage.title')}</h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            clean ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {clean ? `✓ ${t('coverage.ok')}` : `⚠ ${issueCount} ${t('analysis.issuesLabel')}`}
        </span>
      </div>

      {clean ? (
        <p className="text-sm text-green-700">{t('coverage.okHint')}</p>
      ) : (
        <div className="space-y-3">
          {sections
            .filter(section => section.items.length > 0)
            .map(section => (
              <div
                key={section.titleKey}
                className="bg-yellow-50 border border-yellow-200 rounded p-3 space-y-1"
              >
                <p className="text-xs font-medium text-yellow-800">
                  ⚠ {t(section.titleKey)} ({section.items.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {section.items.map((item, i) => (
                    <li key={`${item}-${i}`} className="text-sm text-yellow-700">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {/* One-click repair suggestions (SOT-1101, 2-B). */}
      {fixes.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium text-foreground-muted">🛠 {t('coverage.fix.title')}</p>
          {fixMutation.isError && (
            <p className="text-xs text-red-600">{t('coverage.fix.failed')}</p>
          )}
          <ul className="space-y-2">
            {fixes.map((fix, i) => (
              <li key={`${fix.kind}-${fix.target}-${i}`} className="rounded border border-border p-3 space-y-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{t('review.reason')}: </span>
                  {t(FIX_REASON[fix.kind])} <span className="font-mono">{sampleLabel(fix.target, lang)}</span>
                </p>
                <p className="text-sm text-foreground-muted">
                  <span className="font-medium">{t('review.suggestion')}: </span>{t(FIX_SUGGESTION[fix.kind])}
                </p>
                <button
                  onClick={() => fixMutation.mutate(fix)}
                  disabled={fixMutation.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {fixMutation.isPending ? t('coverage.fix.applying') : t('coverage.fix.apply')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

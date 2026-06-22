import type { StateMachine } from '../types'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import { analyzeCoverage } from '../utils/coverageAnalysis'
import type { MessageKey } from '../i18n/messages'

interface Props {
  machine: StateMachine
}

// Coverage / sanity-check panel (SOT-1036). Computes structural gaps entirely on the
// frontend from the StateMachine model: unreachable steps, deadlocks, undefined and
// duplicate actions. Complements AnalysisPanel (which reads the backend AnalysisResult).
export default function CoveragePanel({ machine }: Props) {
  const { t, lang } = useI18n()
  const result = analyzeCoverage(machine)

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
    </div>
  )
}

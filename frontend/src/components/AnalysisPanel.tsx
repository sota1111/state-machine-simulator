import type { AnalysisResult } from '../types'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'

interface Props {
  analysis: AnalysisResult
}

// Business "inspection result" panel (FlowReview). Surfaces flow gaps so reviewers can
// catch missing/unreachable steps before sign-off. Derived entirely from the existing
// AnalysisResult payload (no backend change).
export default function AnalysisPanel({ analysis }: Props) {
  const { t, lang } = useI18n()

  const hasTerminal = analysis.terminal_states.length > 0
  const undefinedEvents = analysis.undefined_events ?? []
  const issueCount =
    analysis.unreachable_states.length + undefinedEvents.length + (hasTerminal ? 0 : 1)
  const clean = issueCount === 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800">{t('analysis.title')}</h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            clean ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {clean ? `✓ ${t('analysis.ok')}` : `⚠ ${issueCount} ${t('analysis.issuesLabel')}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{analysis.state_count}</div>
          <div className="text-xs text-gray-500">{t('analysis.stateCount')}</div>
        </div>
        <div className="bg-green-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{analysis.transition_count}</div>
          <div className="text-xs text-gray-500">{t('analysis.transitionCount')}</div>
        </div>
        <div className="bg-purple-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{analysis.simulation_run_count}</div>
          <div className="text-xs text-gray-500">{t('analysis.simCount')}</div>
        </div>
        <div className="bg-orange-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{analysis.terminal_states.length}</div>
          <div className="text-xs text-gray-500">{t('analysis.terminalCount')}</div>
        </div>
      </div>

      {(analysis.unreachable_states.length > 0 || undefinedEvents.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 space-y-2">
          <p className="text-sm font-medium text-yellow-800">⚠ {t('analysis.gaps')}</p>
          {analysis.unreachable_states.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-700">{t('analysis.unreachable')}</p>
              <ul className="mt-1 space-y-1">
                {analysis.unreachable_states.map(s => (
                  <li key={s} className="text-sm text-yellow-700">• {sampleLabel(s, lang)}</li>
                ))}
              </ul>
            </div>
          )}
          {undefinedEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-700">{t('analysis.undefinedEvents')}</p>
              <ul className="mt-1 space-y-1">
                {undefinedEvents.map(e => (
                  <li key={e} className="text-sm text-yellow-700">• {sampleLabel(e, lang)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!hasTerminal && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm font-medium text-red-800">⚠ {t('analysis.noTerminal')}</p>
          <p className="mt-1 text-xs text-red-700">{t('analysis.noTerminalHint')}</p>
        </div>
      )}

      {hasTerminal && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <p className="text-sm font-medium text-gray-700">{t('analysis.terminal')}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.terminal_states.map(s => (
              <span key={s} className="px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-700">{sampleLabel(s, lang)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

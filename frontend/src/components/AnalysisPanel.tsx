import type { AnalysisResult } from '../types'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'

interface Props {
  analysis: AnalysisResult
}

export default function AnalysisPanel({ analysis }: Props) {
  const { t, lang } = useI18n()
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-800">{t('analysis.title')}</h3>

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

      {analysis.unreachable_states.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-sm font-medium text-yellow-800">{t('analysis.unreachable')}</p>
          <ul className="mt-1 space-y-1">
            {analysis.unreachable_states.map(s => (
              <li key={s} className="text-sm text-yellow-700">• {sampleLabel(s, lang)}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.terminal_states.length > 0 && (
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

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getModels, getAnalysis } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import { buildReachFunnel } from '../utils/flow'

// Static class maps: Tailwind cannot see dynamically-built class strings (e.g. `bg-${color}-50`),
// so list the full class names here to guarantee they are emitted.
const kpiCardClass: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-100',
  green: 'bg-green-50 border-green-100',
  purple: 'bg-purple-50 border-purple-100',
  orange: 'bg-orange-50 border-orange-100',
}
const kpiValueClass: Record<string, string> = {
  blue: 'text-black',
  green: 'text-black',
  purple: 'text-black',
  orange: 'text-black',
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const [selectedId, setSelectedId] = useState<string>('')

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => getModels(),
  })

  const analysisQueries = useQuery({
    queryKey: ['all-analyses', models?.map(m => m.id)],
    queryFn: async () => {
      if (!models) return []
      return Promise.all(models.map(m => getAnalysis(m.id).catch(() => null)))
    },
    enabled: !!models && models.length > 0,
  })

  if (isLoading) return <div className="text-center py-12 text-foreground-subtle">{t('common.loading')}</div>

  const totalModels = models?.length ?? 0
  const totalStates = models?.reduce((sum, m) => sum + m.states.length, 0) ?? 0
  const totalTransitions = models?.reduce((sum, m) => sum + m.transitions.length, 0) ?? 0
  const totalSimulations = analysisQueries.data?.reduce((sum, a) => sum + (a?.simulation_run_count ?? 0), 0) ?? 0

  const statesLabel = t('dash.colStates')
  const transitionsLabel = t('dash.colTransitions')
  const stateChartData = models?.map(m => ({
    name: m.name.length > 12 ? m.name.slice(0, 12) + '...' : m.name,
    [statesLabel]: m.states.length,
    [transitionsLabel]: m.transitions.length,
  })) ?? []

  const selectedModel = models?.find(m => m.id === selectedId) ?? models?.[0]
  const funnel = selectedModel ? buildReachFunnel(selectedModel) : []
  const funnelMax = funnel.reduce((max, s) => Math.max(max, s.count), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('dash.title')}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('dash.models'), value: totalModels, color: 'blue' },
          { label: t('dash.totalStates'), value: totalStates, color: 'green' },
          { label: t('dash.totalTransitions'), value: totalTransitions, color: 'purple' },
          { label: t('dash.simulations'), value: totalSimulations, color: 'orange' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${kpiCardClass[color]} border rounded-lg p-4 text-center`}>
            <div className={`text-3xl font-bold ${kpiValueClass[color]}`}>{value}</div>
            <div className="text-sm text-foreground-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-foreground-muted">{t('dash.funnelTitle')}</h2>
          {models && models.length > 0 && (
            <select
              value={selectedModel?.id ?? ''}
              onChange={e => setSelectedId(e.target.value)}
              className="max-w-[60%] rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label={t('dash.selectFlow')}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{sampleLabel(m.name, lang)}</option>
              ))}
            </select>
          )}
        </div>

        {funnel.length === 0 ? (
          <p className="text-sm text-foreground-subtle">{t('dash.funnelEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {funnel.map((stage, i) => {
              const widthPct = funnelMax > 0 ? Math.max(8, (stage.count / funnelMax) * 100) : 0
              const conversion = i > 0 && funnel[i - 1].count > 0
                ? Math.round((stage.count / funnel[i - 1].count) * 100)
                : null
              return (
                <div key={stage.depth} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-foreground-subtle">{t('dash.stage')} {stage.depth + 1}</span>
                  <div className="flex-1 bg-surface-muted rounded">
                    <div
                      className="bg-blue-500 text-white text-xs font-medium rounded px-2 py-1 whitespace-nowrap"
                      style={{ width: `${widthPct}%` }}
                    >
                      {stage.count} {t('dash.reachedSteps')}
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-foreground-subtle">
                    {conversion !== null ? `${t('dash.conversion')} ${conversion}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {stateChartData.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="font-semibold text-foreground-muted mb-4">{t('dash.chartTitle')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stateChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey={statesLabel} fill="#3b82f6" />
              <Bar dataKey={transitionsLabel} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {models && models.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="font-semibold text-foreground-muted mb-4">{t('dash.summary')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm responsive-table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-foreground-subtle font-medium">{t('dash.colModel')}</th>
                  <th className="text-right py-2 px-3 text-foreground-subtle font-medium">{t('dash.colStates')}</th>
                  <th className="text-right py-2 px-3 text-foreground-subtle font-medium">{t('dash.colTransitions')}</th>
                  <th className="text-right py-2 px-3 text-foreground-subtle font-medium">{t('dash.colSim')}</th>
                  <th className="text-left py-2 px-3 text-foreground-subtle font-medium">{t('dash.colInitial')}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={m.id} className="border-b border-border hover:bg-surface-muted">
                    <td className="py-2 px-3 font-medium text-foreground" data-label={t('dash.colModel')}>{sampleLabel(m.name, lang)}</td>
                    <td className="py-2 px-3 text-right text-foreground-muted" data-label={t('dash.colStates')}>{m.states.length}</td>
                    <td className="py-2 px-3 text-right text-foreground-muted" data-label={t('dash.colTransitions')}>{m.transitions.length}</td>
                    <td className="py-2 px-3 text-right text-foreground-muted" data-label={t('dash.colSim')}>
                      {analysisQueries.data?.[i]?.simulation_run_count ?? '-'}
                    </td>
                    <td className="py-2 px-3 text-foreground-muted" data-label={t('dash.colInitial')}>{sampleLabel(m.initial_state, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

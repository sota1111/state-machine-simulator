import { useQuery } from '@tanstack/react-query'
import { getModels, getAnalysis } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useI18n } from '../i18n/useI18n'

export default function DashboardPage() {
  const { t } = useI18n()
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

  if (isLoading) return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('dash.title')}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('dash.models'), value: totalModels, color: 'blue' },
          { label: t('dash.totalStates'), value: totalStates, color: 'green' },
          { label: t('dash.totalTransitions'), value: totalTransitions, color: 'purple' },
          { label: t('dash.simulations'), value: totalSimulations, color: 'orange' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-lg p-4 text-center`}>
            <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
            <div className="text-sm text-gray-600 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {stateChartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">{t('dash.chartTitle')}</h2>
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">{t('dash.summary')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm responsive-table">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('dash.colModel')}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{t('dash.colStates')}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{t('dash.colTransitions')}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{t('dash.colSim')}</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('dash.colInitial')}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900" data-label={t('dash.colModel')}>{m.name}</td>
                    <td className="py-2 px-3 text-right text-gray-700" data-label={t('dash.colStates')}>{m.states.length}</td>
                    <td className="py-2 px-3 text-right text-gray-700" data-label={t('dash.colTransitions')}>{m.transitions.length}</td>
                    <td className="py-2 px-3 text-right text-gray-700" data-label={t('dash.colSim')}>
                      {analysisQueries.data?.[i]?.simulation_run_count ?? '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-700" data-label={t('dash.colInitial')}>{m.initial_state}</td>
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

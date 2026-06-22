import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getModels, deleteModel } from '../api'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'

type View = 'mine' | 'sample'

export default function ListPage() {
  const queryClient = useQueryClient()
  const { t, lang } = useI18n()
  const [view, setView] = useState<View>('mine')

  const { data: models, isLoading, error } = useQuery({
    queryKey: ['models', view],
    queryFn: () => getModels(view === 'sample'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  })

  const isSampleView = view === 'sample'

  const tabClass = (active: boolean) =>
    active
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-foreground-muted hover:bg-surface-muted'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('list.title')}</h1>
        <Link
          to="/input"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {t('list.new')}
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('mine')}
          className={tabClass(view === 'mine')}
        >
          {t('list.tabMine')}
        </button>
        <button
          type="button"
          onClick={() => setView('sample')}
          className={tabClass(view === 'sample')}
        >
          {t('list.tabSample')}
        </button>
      </div>

      {isSampleView && (
        <p className="text-sm text-foreground-subtle">{t('list.templateHint')}</p>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-subtle">
          <span className="h-8 w-8 mb-3 rounded-full border-2 border-border border-t-blue-500 animate-spin" aria-hidden />
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2" aria-hidden>⚠️</div>
          <p className="font-semibold text-foreground-muted">{t('list.errorTitle')}</p>
          <p className="text-sm text-foreground-subtle mt-1">{t('list.errorBody')}</p>
        </div>
      ) : !models || models.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-lg border border-border">
          <p className="text-foreground-subtle">
            {isSampleView ? t('list.emptySample') : t('list.emptyMine')}
          </p>
          {!isSampleView && (
            <Link to="/input" className="mt-4 inline-block text-blue-600 hover:underline">
              {t('list.createFirst')}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map(model => (
            <div key={model.id} className="bg-surface rounded-lg border border-border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{sampleLabel(model.name, lang)}</h2>
                  <p className="text-sm text-foreground-subtle mt-1 line-clamp-2">{model.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-foreground-subtle">
                <span>{model.states.length} {t('unit.states')}</span>
                <span>{model.transitions.length} {t('unit.transitions')}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/models/${model.id}`}
                  className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  {t('common.detail')}
                </Link>
                {!isSampleView && (
                  <button
                    onClick={() => {
                      const confirmMsg = lang === 'ja'
                        ? `「${model.name}」を削除しますか？`
                        : `Delete "${model.name}"?`
                      if (confirm(confirmMsg)) {
                        deleteMutation.mutate(model.id)
                      }
                    }}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getModels, deleteModel } from '../api'

export default function ListPage() {
  const queryClient = useQueryClient()
  const { data: models, isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  })

  if (isLoading) return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  if (error) return <div className="text-center py-12 text-red-500">エラーが発生しました</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">状態遷移モデル一覧</h1>
        <Link
          to="/input"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 新規作成
        </Link>
      </div>

      {!models || models.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">モデルがありません</p>
          <Link to="/input" className="mt-4 inline-block text-blue-600 hover:underline">
            最初のモデルを作成する
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map(model => (
            <div key={model.id} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{model.name}</h2>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{model.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                <span>{model.states.length} 状態</span>
                <span>{model.transitions.length} 遷移</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/models/${model.id}`}
                  className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  詳細
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`「${model.name}」を削除しますか？`)) {
                      deleteMutation.mutate(model.id)
                    }
                  }}
                  className="px-3 py-1.5 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

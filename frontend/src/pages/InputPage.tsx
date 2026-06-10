import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { parseText, createModel } from '../api'
import type { ParseResponse } from '../types'

export default function InputPage() {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const parseMutation = useMutation({
    mutationFn: parseText,
    onSuccess: (data) => {
      setParsed(data)
      setError(null)
    },
    onError: (err: { response?: { data?: { detail?: string } }; message: string }) => {
      setError(err.response?.data?.detail ?? err.message)
    }
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error('No parsed data')
      return createModel({
        name: parsed.name,
        description: parsed.description ?? '',
        initial_state: parsed.initial_state,
        states: parsed.states.map(s => ({ name: s.name, description: s.description ?? '', is_terminal: s.is_terminal ?? false })),
        transitions: parsed.transitions.map(t => ({ from_state: t.from_state, to_state: t.to_state, event: t.event })),
      } as Parameters<typeof createModel>[0])
    },
    onSuccess: (model) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      navigate(`/models/${model.id}`)
    },
    onError: (err: { response?: { data?: { detail?: string } }; message: string }) => {
      setError(err.response?.data?.detail ?? err.message)
    }
  })

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規モデル作成</h1>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            状態遷移仕様を自然言語で記述してください
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: ユーザーがログイン画面でIDとパスワードを入力して送信すると認証中状態になります。認証に成功するとログイン済み状態に遷移します。失敗した場合はエラー状態になります。ログアウト操作でログアウト状態に戻ります。"
            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => parseMutation.mutate(text)}
          disabled={!text.trim() || parseMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {parseMutation.isPending ? '解析中...' : 'AIで解析する'}
        </button>
      </div>

      {parsed && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">解析結果</h2>
          
          <div className="grid gap-3">
            <div>
              <span className="text-sm font-medium text-gray-500">モデル名:</span>
              <span className="ml-2 text-sm text-gray-900">{parsed.name}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">初期状態:</span>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">{parsed.initial_state}</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">状態一覧 ({parsed.states.length}件)</p>
            <div className="flex flex-wrap gap-2">
              {parsed.states.map(s => (
                <span key={s.name} className={`px-2 py-1 rounded text-xs ${s.is_terminal ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                  {s.name}{s.is_terminal ? ' (終端)' : ''}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">遷移一覧 ({parsed.transitions.length}件)</p>
            <div className="space-y-1">
              {parsed.transitions.map((t, i) => (
                <div key={i} className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                  {t.from_state} --[{t.event}]--&gt; {t.to_state}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? '保存中...' : 'このモデルを保存する'}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              やり直す
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

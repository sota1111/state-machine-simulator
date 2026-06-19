import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { parseText, createModel } from '../api'
import type { ParseResponse } from '../types'

type Mode = 'ai' | 'manual'

interface ManualState {
  name: string
  description: string
  is_terminal: boolean
}

interface ManualTransition {
  from_state: string
  to_state: string
  event: string
}

export default function InputPage() {
  const [mode, setMode] = useState<Mode>('ai')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Manual mode state
  const [manualName, setManualName] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualInitialState, setManualInitialState] = useState('')
  const [manualStates, setManualStates] = useState<ManualState[]>([{ name: '', description: '', is_terminal: false }])
  const [manualTransitions, setManualTransitions] = useState<ManualTransition[]>([{ from_state: '', to_state: '', event: '' }])

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
    mutationFn: (data: Parameters<typeof createModel>[0]) => createModel(data),
    onSuccess: (model) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      navigate(`/models/${model.id}`)
    },
    onError: (err: { response?: { data?: { detail?: string } }; message: string }) => {
      setError(err.response?.data?.detail ?? err.message)
    }
  })

  const handleSaveParsed = () => {
    if (!parsed) return
    saveMutation.mutate({
      name: parsed.name,
      description: parsed.description ?? '',
      initial_state: parsed.initial_state,
      states: parsed.states.map(s => ({ name: s.name, description: s.description ?? '', is_terminal: s.is_terminal ?? false })),
      transitions: parsed.transitions.map(t => ({ from_state: t.from_state, to_state: t.to_state, event: t.event })),
    })
  }

  const handleSaveManual = () => {
    setError(null)
    const validStates = manualStates.filter(s => s.name.trim())
    if (!manualName.trim()) { setError('モデル名を入力してください'); return }
    if (validStates.length === 0) { setError('最低1つの状態を入力してください'); return }
    if (!manualInitialState.trim()) { setError('初期状態を入力してください'); return }
    if (!validStates.find(s => s.name === manualInitialState)) {
      setError('初期状態は状態一覧に含まれている必要があります')
      return
    }
    const validTransitions = manualTransitions.filter(t => t.from_state.trim() && t.to_state.trim() && t.event.trim())
    saveMutation.mutate({
      name: manualName,
      description: manualDescription,
      initial_state: manualInitialState,
      states: validStates,
      transitions: validTransitions,
    })
  }

  const addState = () => setManualStates([...manualStates, { name: '', description: '', is_terminal: false }])
  const removeState = (i: number) => setManualStates(manualStates.filter((_, idx) => idx !== i))
  const updateState = (i: number, field: keyof ManualState, value: string | boolean) =>
    setManualStates(manualStates.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  const addTransition = () => setManualTransitions([...manualTransitions, { from_state: '', to_state: '', event: '' }])
  const removeTransition = (i: number) => setManualTransitions(manualTransitions.filter((_, idx) => idx !== i))
  const updateTransition = (i: number, field: keyof ManualTransition, value: string) =>
    setManualTransitions(manualTransitions.map((t, idx) => idx === i ? { ...t, [field]: value } : t))

  const stateNames = manualStates.filter(s => s.name.trim()).map(s => s.name)

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規モデル作成</h1>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          🤖 AIで解析
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          ✏️ 手動作成
        </button>
      </div>

      {/* AI mode */}
      {mode === 'ai' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状態遷移仕様を自然言語で記述してください
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例: ユーザーがログイン画面でIDとパスワードを入力して送信すると認証中状態になります..."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              <p className="font-medium">AI解析に失敗しました</p>
              <p className="mt-1">{error}</p>
              {error.includes('GEMINI_API_KEY') ? (
                <button onClick={() => { setMode('manual'); setError(null) }} className="mt-2 block text-blue-600 underline text-xs">
                  手動作成モードに切り替える →
                </button>
              ) : (
                <button
                  onClick={() => parseMutation.mutate(text)}
                  disabled={!text.trim() || parseMutation.isPending}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {parseMutation.isPending ? '再試行中...' : '🔄 再試行'}
                </button>
              )}
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
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">モデル名 *</label>
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="例: ログインフロー"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <input
                type="text"
                value={manualDescription}
                onChange={e => setManualDescription(e.target.value)}
                placeholder="任意の説明"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">初期状態 *</label>
              <input
                type="text"
                value={manualInitialState}
                onChange={e => setManualInitialState(e.target.value)}
                placeholder="例: ログアウト"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* States */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">状態一覧 *</label>
              <button onClick={addState} className="text-xs text-blue-600 hover:underline">+ 追加</button>
            </div>
            <div className="space-y-2">
              {manualStates.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => updateState(i, 'name', e.target.value)}
                    placeholder="状態名"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={s.description}
                    onChange={e => updateState(i, 'description', e.target.value)}
                    placeholder="説明（任意）"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                    <input type="checkbox" checked={s.is_terminal} onChange={e => updateState(i, 'is_terminal', e.target.checked)} />
                    終端
                  </label>
                  <button onClick={() => removeState(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Transitions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">遷移一覧</label>
              <button onClick={addTransition} className="text-xs text-blue-600 hover:underline">+ 追加</button>
            </div>
            <div className="space-y-2">
              {manualTransitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={t.from_state}
                    onChange={e => updateTransition(i, 'from_state', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">送信元</option>
                    {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input
                    type="text"
                    value={t.event}
                    onChange={e => updateTransition(i, 'event', e.target.value)}
                    placeholder="イベント名"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={t.to_state}
                    onChange={e => updateTransition(i, 'to_state', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">送信先</option>
                    {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={() => removeTransition(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={handleSaveManual}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? '保存中...' : 'モデルを保存する'}
          </button>
        </div>
      )}

      {/* AI parse results */}
      {parsed && mode === 'ai' && (
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
              onClick={handleSaveParsed}
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

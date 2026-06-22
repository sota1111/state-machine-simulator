import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { parseText, refineWorkflow, importFlow, createModel } from '../api'
import type { ParseResponse, StateMachine } from '../types'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import StateDiagram from '../components/StateDiagram'
import CoveragePanel from '../components/CoveragePanel'
import ReviewPanel from '../components/ReviewPanel'
import TestCasesPanel from '../components/TestCasesPanel'

type Mode = 'ai' | 'import' | 'manual'
type ImportSource = 'auto' | 'code' | 'procedure'

// AI入力モードの入力例プリセット（SOT-1020 / 提案4）。
const AI_PRESETS: { labelKey: MessageKey; textKey: MessageKey }[] = [
  { labelKey: 'input.preset.support', textKey: 'input.preset.support.text' },
  { labelKey: 'input.preset.order', textKey: 'input.preset.order.text' },
  { labelKey: 'input.preset.approval', textKey: 'input.preset.approval.text' },
]

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
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('ai')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  // Import mode (SOT-1104, 2-E): paste code / a procedure document.
  const [importText, setImportText] = useState('')
  const [importSource, setImportSource] = useState<ImportSource>('auto')
  const [error, setError] = useState<string | null>(null)
  // 解析結果カードの詳細項目（フロー名/開始工程/工程一覧/アクション一覧/網羅性チェック）の表示制御。
  // SOT-1082: 初期は非表示にし、トグルで表示/非表示を切り替える。
  const [showDetails, setShowDetails] = useState(false)

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

  const refineMutation = useMutation({
    mutationFn: (instruction: string) => {
      if (!parsed) return Promise.reject(new Error('No workflow to refine'))
      return refineWorkflow({
        instruction,
        name: parsed.name,
        description: parsed.description ?? '',
        initial_state: parsed.initial_state,
        states: parsed.states.map(s => ({ name: s.name, description: s.description ?? '', is_terminal: s.is_terminal ?? false })),
        transitions: parsed.transitions.map(t => ({ from_state: t.from_state, to_state: t.to_state, event: t.event })),
      })
    },
    onSuccess: (data) => {
      setParsed(data)
      setRefineInstruction('')
      setError(null)
    },
    onError: (err: { response?: { data?: { detail?: string } }; message: string }) => {
      setError(err.response?.data?.detail ?? err.message)
    }
  })

  const importMutation = useMutation({
    mutationFn: () => importFlow(importText, importSource),
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

  // Adapt an AI parse result (no IDs) into a full StateMachine so it can be
  // previewed with the StateDiagram component. State `id` is set to the state
  // name so transitions (which reference state names) resolve to the same node keys.
  const previewMachine: StateMachine | null = parsed
    ? {
        id: 'preview',
        name: parsed.name,
        description: parsed.description ?? '',
        initial_state: parsed.initial_state,
        is_sample: false,
        created_at: '',
        updated_at: '',
        states: parsed.states.map(s => ({
          id: s.name,
          machine_id: 'preview',
          name: s.name,
          description: s.description ?? '',
          is_terminal: s.is_terminal ?? false,
        })),
        transitions: parsed.transitions.map((tr, i) => ({
          id: `t${i}`,
          machine_id: 'preview',
          from_state: tr.from_state,
          to_state: tr.to_state,
          event: tr.event,
        })),
      }
    : null

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
    if (!manualName.trim()) { setError(t('input.errNameRequired')); return }
    if (validStates.length === 0) { setError(t('input.errStateRequired')); return }
    if (!manualInitialState.trim()) { setError(t('input.errInitialRequired')); return }
    if (!validStates.find(s => s.name === manualInitialState)) {
      setError(t('input.errInitialInList'))
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
      <h1 className="text-2xl font-bold text-foreground">{t('input.title')}</h1>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-surface text-foreground-muted hover:bg-surface-muted'}`}
        >
          {t('input.modeAi')}
        </button>
        <button
          onClick={() => setMode('import')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'import' ? 'bg-blue-600 text-white' : 'bg-surface text-foreground-muted hover:bg-surface-muted'}`}
        >
          {t('input.modeImport')}
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-surface text-foreground-muted hover:bg-surface-muted'}`}
        >
          {t('input.modeManual')}
        </button>
      </div>

      {/* Import mode (SOT-1104, 2-E) */}
      {mode === 'import' && (
        <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <p className="text-sm text-foreground-muted">{t('input.importHint')}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground-subtle">{t('input.importSource')}</span>
            <select
              value={importSource}
              onChange={e => setImportSource(e.target.value as ImportSource)}
              className="text-sm border border-border rounded-md px-2 py-1 bg-surface text-foreground"
            >
              <option value="auto">{t('input.importSourceAuto')}</option>
              <option value="code">{t('input.importSourceCode')}</option>
              <option value="procedure">{t('input.importSourceProcedure')}</option>
            </select>
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={t('input.importPlaceholder')}
            className="w-full h-48 px-3 py-2 border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              <p className="font-medium">{t('input.importFailed')}</p>
              <p className="mt-1">{error}</p>
            </div>
          )}
          <button
            onClick={() => importMutation.mutate()}
            disabled={!importText.trim() || importMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {importMutation.isPending ? t('input.importing') : t('input.importBtn')}
          </button>
        </div>
      )}

      {/* AI mode */}
      {mode === 'ai' && (
        <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
          {/* 入力例プリセット（SOT-1020 / 提案4）。クリックで textarea を埋める。 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground-subtle">{t('input.presetsLabel')}</span>
            {AI_PRESETS.map(p => (
              <button
                key={p.labelKey}
                type="button"
                onClick={() => { setText(t(p.textKey)); setError(null) }}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-2">
              {t('input.aiLabel')}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('input.aiPlaceholder')}
              className="w-full h-40 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 自然言語による修正（SOT-1076）。SOT-1082: 記述textareaの直下に配置。解析済みのときのみ表示。 */}
          {parsed && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground-muted">{t('input.refineLabel')}</label>
              <textarea
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                placeholder={t('input.refinePlaceholder')}
                className="w-full h-24 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              <p className="font-medium">{t('input.aiFailed')}</p>
              <p className="mt-1">{error}</p>
              {error.includes('GEMINI_API_KEY') ? (
                <button onClick={() => { setMode('manual'); setError(null) }} className="mt-2 block text-blue-600 underline text-xs">
                  {t('input.switchManual')}
                </button>
              ) : (
                <button
                  onClick={() => parseMutation.mutate(text)}
                  disabled={!text.trim() || parseMutation.isPending}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {parseMutation.isPending ? t('input.retrying') : t('input.retry')}
                </button>
              )}
            </div>
          )}

          {/* SOT-1082: 「AIで解析する」と「🪄 修正する」を横並びで表示。修正は解析済みのときのみ。 */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => parseMutation.mutate(text)}
              disabled={!text.trim() || parseMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {parseMutation.isPending ? t('input.parsing') : t('input.parseBtn')}
            </button>
            {parsed && (
              <button
                onClick={() => refineMutation.mutate(refineInstruction)}
                disabled={!refineInstruction.trim() || refineMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {refineMutation.isPending ? t('input.refining') : t('input.refineBtn')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="bg-surface rounded-lg border border-border p-6 space-y-6">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">{t('input.modelNameReq')}</label>
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder={t('input.modelNamePlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">{t('input.description')}</label>
              <input
                type="text"
                value={manualDescription}
                onChange={e => setManualDescription(e.target.value)}
                placeholder={t('input.descPlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">{t('input.initialStateReq')}</label>
              <input
                type="text"
                value={manualInitialState}
                onChange={e => setManualInitialState(e.target.value)}
                placeholder={t('input.initialPlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* States */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground-muted">{t('input.statesLabelReq')}</label>
              <button onClick={addState} className="text-xs text-blue-600 hover:underline">{t('input.add')}</button>
            </div>
            <div className="space-y-2">
              {manualStates.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => updateState(i, 'name', e.target.value)}
                    placeholder={t('input.statePlaceholder')}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={s.description}
                    onChange={e => updateState(i, 'description', e.target.value)}
                    placeholder={t('input.stateDescPlaceholder')}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <label className="flex items-center gap-1 text-xs text-foreground-muted whitespace-nowrap">
                    <input type="checkbox" checked={s.is_terminal} onChange={e => updateState(i, 'is_terminal', e.target.checked)} />
                    {t('input.terminal')}
                  </label>
                  <button onClick={() => removeState(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Transitions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground-muted">{t('input.transitionsLabel')}</label>
              <button onClick={addTransition} className="text-xs text-blue-600 hover:underline">{t('input.add')}</button>
            </div>
            <div className="space-y-2">
              {manualTransitions.map((tr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={tr.from_state}
                    onChange={e => updateTransition(i, 'from_state', e.target.value)}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">{t('input.fromState')}</option>
                    {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input
                    type="text"
                    value={tr.event}
                    onChange={e => updateTransition(i, 'event', e.target.value)}
                    placeholder={t('input.eventPlaceholder')}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={tr.to_state}
                    onChange={e => updateTransition(i, 'to_state', e.target.value)}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">{t('input.toState')}</option>
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
            {saveMutation.isPending ? t('input.saving') : t('input.saveModel')}
          </button>
        </div>
      )}

      {/* AI parse / import results */}
      {parsed && (mode === 'ai' || mode === 'import') && (
        <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">{t('input.parseResult')}</h2>

          {/* SOT-1082: 業務フロー図を最上部に配置 */}
          {previewMachine && previewMachine.states.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground-subtle mb-2">{t('detail.diagram')}</p>
              <StateDiagram machine={previewMachine} />
            </div>
          )}

          {/* SOT-1082: 詳細項目（フロー名/開始工程/工程一覧/アクション一覧/網羅性チェック）の表示切替。初期非表示。 */}
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="px-3 py-1.5 border border-border rounded text-sm font-medium text-foreground-muted hover:bg-surface-muted transition-colors"
          >
            {showDetails ? t('input.hideDetails') : t('input.showDetails')}
          </button>

          {showDetails && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <span className="text-sm font-medium text-foreground-subtle">{t('input.modelNameField')}:</span>
                  <span className="ml-2 text-sm text-foreground">{parsed.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground-subtle">{t('input.initialStateField')}:</span>
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">{parsed.initial_state}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground-subtle mb-2">{t('detail.statesList')} ({parsed.states.length})</p>
                <div className="flex flex-wrap gap-2">
                  {parsed.states.map(s => (
                    <span key={s.name} className={`px-2 py-1 rounded text-xs ${s.is_terminal ? 'bg-surface-muted text-foreground-muted' : 'bg-green-100 text-green-800'}`}>
                      {s.name}{s.is_terminal ? ` (${t('detail.terminalTag')})` : ''}
                    </span>
                  ))}
                </div>
              </div>

              {parsed.events.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground-subtle mb-2">{t('detail.eventsList')} ({parsed.events.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {parsed.events.map(ev => (
                      <span key={ev} className="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-800 font-mono">{ev}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-foreground-subtle mb-2">{t('detail.transitionsList')} ({parsed.transitions.length})</p>
                <div className="space-y-1">
                  {parsed.transitions.map((t, i) => (
                    <div key={i} className="text-xs text-foreground-muted font-mono bg-surface-muted px-2 py-1 rounded">
                      {t.from_state} --[{t.event}]--&gt; {t.to_state}
                    </div>
                  ))}
                </div>
              </div>

              {previewMachine && previewMachine.states.length > 0 && (
                <CoveragePanel machine={previewMachine} />
              )}

              {previewMachine && previewMachine.states.length > 0 && (
                <ReviewPanel machine={previewMachine} specText={mode === 'import' ? importText : text} />
              )}

              {previewMachine && previewMachine.states.length > 0 && (
                <TestCasesPanel machine={previewMachine} />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveParsed}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? t('input.saving') : t('input.saveThisModel')}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="px-4 py-2 border border-border text-foreground-muted rounded-lg text-sm hover:bg-surface-muted transition-colors"
            >
              {t('input.redo')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

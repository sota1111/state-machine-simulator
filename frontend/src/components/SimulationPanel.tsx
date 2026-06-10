import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { simulateStep } from '../api'
import type { StateMachine } from '../types'

interface Props {
  machine: StateMachine
  onStateChange: (state: string) => void
}

export default function SimulationPanel({ machine, onStateChange }: Props) {
  const [currentState, setCurrentState] = useState(machine.initial_state)
  const [log, setLog] = useState<string[]>([`初期状態: ${machine.initial_state}`])
  const queryClient = useQueryClient()

  const availableEvents = machine.transitions
    .filter(t => t.from_state === currentState)
    .map(t => t.event)

  const mutation = useMutation({
    mutationFn: (event: string) => simulateStep(machine.id, { current_state: currentState, event }),
    onSuccess: (data) => {
      if (data.success && data.next_state) {
        setLog(prev => [...prev, `${currentState} --[${data.next_state}]--> ${data.next_state}`])
        setCurrentState(data.next_state)
        onStateChange(data.next_state)
        queryClient.invalidateQueries({ queryKey: ['history', machine.id] })
      } else {
        setLog(prev => [...prev, `エラー: ${data.message}`])
      }
    }
  })

  const handleReset = () => {
    setCurrentState(machine.initial_state)
    setLog([`リセット → 初期状態: ${machine.initial_state}`])
    onStateChange(machine.initial_state)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-800">シミュレーション</h3>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">現在の状態:</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          {currentState}
        </span>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2">実行可能なイベント:</p>
        {availableEvents.length === 0 ? (
          <p className="text-sm text-gray-400 italic">終端状態（イベントなし）</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableEvents.map(event => (
              <button
                key={event}
                onClick={() => mutation.mutate(event)}
                disabled={mutation.isPending}
                className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {event}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleReset}
        className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50 transition-colors"
      >
        リセット
      </button>

      <div className="bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
        <p className="text-xs text-gray-500 mb-1">ログ:</p>
        {log.map((entry, i) => (
          <p key={i} className="text-xs text-gray-700 font-mono">{entry}</p>
        ))}
      </div>
    </div>
  )
}

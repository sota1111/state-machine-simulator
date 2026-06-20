import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { StateMachine } from '../types'
import StateDiagramEditor from './StateDiagramEditor'

function sampleMachine(): StateMachine {
  return {
    id: 'm1',
    name: 'ログインフロー',
    description: 'desc',
    initial_state: 'ログアウト',
    is_sample: false,
    created_at: '',
    updated_at: '',
    states: [
      { id: 's1', machine_id: 'm1', name: 'ログアウト', description: '', is_terminal: false },
      { id: 's2', machine_id: 'm1', name: 'ログイン中', description: '', is_terminal: true },
    ],
    transitions: [
      { id: 't1', machine_id: 'm1', from_state: 'ログアウト', to_state: 'ログイン中', event: 'login' },
    ],
  }
}

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StateDiagramEditor machine={sampleMachine()} />
    </QueryClientProvider>,
  )
}

describe('StateDiagramEditor', () => {
  it('renders existing state nodes', () => {
    renderEditor()
    expect(screen.getByTestId('node-ログアウト')).toBeInTheDocument()
    expect(screen.getByTestId('node-ログイン中')).toBeInTheDocument()
  })

  it('adds a new state node when the add button is clicked', () => {
    renderEditor()
    fireEvent.click(screen.getByText('+ 状態を追加'))
    expect(screen.getByTestId('node-状態3')).toBeInTheDocument()
  })

  it('shows the inspector and edits a state name when a node is selected', () => {
    renderEditor()
    fireEvent.pointerDown(screen.getByTestId('node-ログアウト'))
    const input = screen.getByLabelText('状態名') as HTMLInputElement
    expect(input.value).toBe('ログアウト')
    fireEvent.change(input, { target: { value: 'サインアウト' } })
    expect(screen.getByTestId('node-サインアウト')).toBeInTheDocument()
  })
})

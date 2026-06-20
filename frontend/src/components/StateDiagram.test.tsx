import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { StateMachine } from '../types'
import StateDiagram from './StateDiagram'

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

function svgWidth(): number {
  const svg = document.querySelector('svg') as SVGSVGElement
  return parseFloat(svg.getAttribute('width') || '0')
}

describe('StateDiagram zoom controls (SOT-948)', () => {
  it('renders 拡大 / 縮小 / 全体表示 buttons and a zoom percentage', () => {
    render(<StateDiagram machine={sampleMachine()} />)
    expect(screen.getByLabelText('拡大')).toBeInTheDocument()
    expect(screen.getByLabelText('縮小')).toBeInTheDocument()
    expect(screen.getByLabelText('全体表示（縮尺リセット）')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('拡大 increases the rendered diagram size and percentage', () => {
    render(<StateDiagram machine={sampleMachine()} />)
    const before = svgWidth()
    fireEvent.click(screen.getByLabelText('拡大'))
    expect(svgWidth()).toBeGreaterThan(before)
    expect(screen.getByText('110%')).toBeInTheDocument()
  })

  it('縮小 decreases the rendered diagram size', () => {
    render(<StateDiagram machine={sampleMachine()} />)
    const before = svgWidth()
    fireEvent.click(screen.getByLabelText('縮小'))
    expect(svgWidth()).toBeLessThan(before)
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('全体表示 resets back to the fit (100%) scale after manual zoom', () => {
    render(<StateDiagram machine={sampleMachine()} />)
    fireEvent.click(screen.getByLabelText('拡大'))
    expect(screen.getByText('110%')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('全体表示（縮尺リセット）'))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})

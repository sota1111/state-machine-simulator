import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import type { StateMachine } from '../types'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

interface Props {
  machine: StateMachine
  currentState?: string
}

function buildMermaidDiagram(machine: StateMachine, currentState?: string): string {
  const lines: string[] = ['stateDiagram-v2']
  lines.push(`    [*] --> ${machine.initial_state.replace(/\s/g, '_')}`)
  
  for (const t of machine.transitions) {
    const from = t.from_state.replace(/\s/g, '_')
    const to = t.to_state.replace(/\s/g, '_')
    lines.push(`    ${from} --> ${to} : ${t.event}`)
  }
  
  for (const s of machine.states) {
    if (s.is_terminal) {
      const name = s.name.replace(/\s/g, '_')
      lines.push(`    ${name} --> [*]`)
    }
  }

  if (currentState) {
    const current = currentState.replace(/\s/g, '_')
    lines.push('    classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px')
    lines.push(`    class ${current} current`)
  }
  
  return lines.join('\n')
}

export default function StateDiagram({ machine, currentState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-${machine.id}-${Date.now()}`)

  useEffect(() => {
    if (!containerRef.current) return
    const diagram = buildMermaidDiagram(machine, currentState)
    const id = idRef.current
    
    containerRef.current.innerHTML = `<div class="mermaid" id="${id}">${diagram}</div>`
    
    mermaid.run({ nodes: [document.getElementById(id)!] }).catch(console.error)
  }, [machine, currentState])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-auto">
      <div ref={containerRef} />
    </div>
  )
}

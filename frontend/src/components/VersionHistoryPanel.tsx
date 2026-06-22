import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { StateMachine } from '../types'
import { getVersions, getVersion } from '../api'
import { useI18n } from '../i18n/useI18n'
import { sampleLabel } from '../i18n/sampleLabels'
import { diffFlows, isEmptyDiff, type FlowSnapshot } from '../utils/versionDiff'

interface Props {
  machine: StateMachine
}

// Version history + diff view (SOT-1102, 2-C). Lists stored snapshots and shows the
// diff between a selected historical version and the current machine.
export default function VersionHistoryPanel({ machine }: Props) {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)

  const { data: versions = [] } = useQuery({
    queryKey: ['versions', machine.id, machine.updated_at],
    queryFn: () => getVersions(machine.id),
  })

  const { data: version } = useQuery({
    queryKey: ['version', machine.id, selected],
    queryFn: () => getVersion(machine.id, selected as number),
    enabled: selected !== null,
  })

  const current: FlowSnapshot = {
    initial_state: machine.initial_state,
    states: machine.states,
    transitions: machine.transitions,
  }

  const diff = version
    ? diffFlows(
        { initial_state: version.initial_state, states: version.states, transitions: version.transitions },
        current,
      )
    : null

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card p-4 space-y-3">
      <h3 className="font-semibold text-foreground">{t('version.title')}</h3>
      <p className="text-xs text-foreground-subtle">{t('version.hint')}</p>

      {versions.length === 0 ? (
        <p className="text-sm text-foreground-subtle italic">{t('version.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {versions.map(v => (
            <li key={v.version}>
              <button
                onClick={() => setSelected(prev => (prev === v.version ? null : v.version))}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selected === v.version
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-surface-muted text-foreground-muted hover:bg-surface-muted'
                }`}
              >
                v{v.version} · {new Date(v.saved_at).toLocaleString()}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected !== null && diff && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium text-foreground-muted">
            {t('version.diffTitle')} (v{selected} → {t('version.current')})
          </p>
          {isEmptyDiff(diff) ? (
            <p className="text-sm text-green-700">{t('version.noChange')}</p>
          ) : (
            <div className="space-y-2 text-sm">
              {diff.initialChanged && (
                <p className="text-foreground">
                  {t('version.initialChanged')}: <span className="font-mono">{sampleLabel(diff.initialChanged.from, lang)}</span> → <span className="font-mono">{sampleLabel(diff.initialChanged.to, lang)}</span>
                </p>
              )}
              {diff.addedStates.length > 0 && (
                <DiffBlock label={`+ ${t('version.addedStates')}`} items={diff.addedStates.map(s => sampleLabel(s, lang))} tone="add" />
              )}
              {diff.removedStates.length > 0 && (
                <DiffBlock label={`- ${t('version.removedStates')}`} items={diff.removedStates.map(s => sampleLabel(s, lang))} tone="remove" />
              )}
              {diff.addedTransitions.length > 0 && (
                <DiffBlock label={`+ ${t('version.addedTransitions')}`} items={diff.addedTransitions} tone="add" />
              )}
              {diff.removedTransitions.length > 0 && (
                <DiffBlock label={`- ${t('version.removedTransitions')}`} items={diff.removedTransitions} tone="remove" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DiffBlock({ label, items, tone }: { label: string; items: string[]; tone: 'add' | 'remove' }) {
  const color = tone === 'add' ? 'text-green-700' : 'text-red-600'
  return (
    <div>
      <p className={`text-xs font-medium ${color}`}>{label}</p>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className={`text-xs font-mono ${color}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

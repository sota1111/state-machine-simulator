import { useCallback, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

interface ReviewComment {
  id: string
  body: string
  createdAt: string
}

const storageKey = (machineId: string) => `flowreview.reviewComments.${machineId}`

function loadComments(machineId: string): ReviewComment[] {
  try {
    const raw = localStorage.getItem(storageKey(machineId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ReviewComment[]) : []
  } catch {
    return []
  }
}

function saveComments(machineId: string, comments: ReviewComment[]) {
  try {
    localStorage.setItem(storageKey(machineId), JSON.stringify(comments))
  } catch {
    // ignore quota / availability errors — comments are a best-effort local aid
  }
}

interface Props {
  machineId: string
}

// Lightweight, localStorage-backed review comments so reviewers can leave findings on a
// flow without any backend. Scoped per flow (machineId). Frontend-only MVP.
export default function ReviewComments({ machineId }: Props) {
  const { t, lang } = useI18n()
  const [comments, setComments] = useState<ReviewComment[]>(() => loadComments(machineId))
  const [draft, setDraft] = useState('')

  const persist = useCallback(
    (next: ReviewComment[]) => {
      setComments(next)
      saveComments(machineId, next)
    },
    [machineId],
  )

  const handleAdd = () => {
    const body = draft.trim()
    if (!body) return
    const comment: ReviewComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body,
      createdAt: new Date().toISOString(),
    }
    persist([comment, ...comments])
    setDraft('')
  }

  const handleDelete = (id: string) => {
    persist(comments.filter(c => c.id !== id))
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="font-semibold text-gray-800">{t('review.title')}</h3>

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('review.placeholder')}
          rows={2}
          className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="self-end px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {t('review.add')}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">{t('review.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {comments.map(c => (
            <li key={c.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words flex-1">{c.body}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  {t('review.delete')}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{formatDate(c.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

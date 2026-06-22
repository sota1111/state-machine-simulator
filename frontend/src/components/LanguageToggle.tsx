import { useI18n } from '../i18n/useI18n'

// JP/EN language toggle, always visible in the nav. The active language is highlighted.
export default function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  const segment = (value: 'ja' | 'en', label: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      className={`px-2 py-1 text-xs font-semibold transition-colors ${
        lang === value ? 'bg-blue-600 text-white' : 'bg-surface text-foreground-muted hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      className="inline-flex rounded-md border border-border overflow-hidden shrink-0"
      role="group"
      aria-label={t('lang.toggleAria')}
    >
      {segment('ja', 'JP')}
      {segment('en', 'EN')}
    </div>
  )
}

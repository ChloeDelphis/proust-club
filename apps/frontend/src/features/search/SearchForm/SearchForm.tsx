import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { validationConstraints } from '../../../api/generated/validationConstraints.generated'
import styles from './SearchForm.module.css'

const { q: queryConstraints } = validationConstraints.search

interface SearchFormProps {
  initialValue?: string
  onSubmit: (query: string) => void
}

// No minimum-length validation here on purpose — a short/empty query is meaningful (it's how a
// saved-citations text filter gets cleared, see SearchPage). The 2-character floor only applies to
// corpus search, and that's already handled there (empty-state placeholder, no request fired).
export default function SearchForm({ initialValue = '', onSubmit }: SearchFormProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(value.trim())
  }

  function handleClear() {
    setValue('')
    onSubmit('')
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="search"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t('searchForm.placeholder')}
          aria-label={t('searchForm.ariaLabel')}
          maxLength={queryConstraints.maxLength}
        />
        {value && (
          <button type="button" className={styles.clearButton} onClick={handleClear} aria-label={t('searchForm.clearButton')}>
            ×
          </button>
        )}
        <button className={styles.button} type="submit">
          {t('searchForm.submitButton')}
        </button>
      </div>
    </form>
  )
}

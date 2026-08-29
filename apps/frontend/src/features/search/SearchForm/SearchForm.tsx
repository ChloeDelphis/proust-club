import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { validationConstraints } from '../../../api/generated/validationConstraints.generated'
import styles from './SearchForm.module.css'

const { q: queryConstraints } = validationConstraints.search

interface SearchFormProps {
  onSubmit: (query: string) => void
}

export default function SearchForm({ onSubmit }: SearchFormProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length < queryConstraints.minLength) {
      setError(t('searchForm.tooShortError'))
      return
    }
    setError('')
    onSubmit(trimmed)
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
        <button className={styles.button} type="submit">
          {t('searchForm.submitButton')}
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

import { useState } from 'react'
import styles from './SearchForm.module.css'

interface SearchFormProps {
  onSubmit: (query: string) => void
}

export default function SearchForm({ onSubmit }: SearchFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setError('Saisissez au moins 2 caractères.')
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
          placeholder="Rechercher dans Proust…"
          aria-label="Rechercher un passage"
          maxLength={500}
        />
        <button className={styles.button} type="submit">
          Chercher
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

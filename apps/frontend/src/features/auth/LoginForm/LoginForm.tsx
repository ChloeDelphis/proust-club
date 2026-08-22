import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LoginFormProps } from './LoginForm.types'
import FormField from '../FormField/FormField'
import styles from '../AuthForm.module.css'

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError(t('loginForm.missingFieldsError'))
      return
    }
    setError('')
    onSubmit({ username: username.trim(), password })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('loginForm.usernameLabel')}
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
      />
      <FormField
        label={t('loginForm.passwordLabel')}
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <button className={styles.button} type="submit">
        {t('loginForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

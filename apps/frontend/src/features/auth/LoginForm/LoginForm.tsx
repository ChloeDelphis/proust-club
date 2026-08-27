import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LoginFormProps } from './LoginForm.types'
import FormField from '../FormField/FormField'
import { emailFormatError } from '../emailValidation'
import styles from '../AuthForm.module.css'

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError(t('loginForm.missingFieldsError'))
      return
    }
    const emailError = emailFormatError(trimmedEmail)
    if (emailError) {
      setError(emailError)
      return
    }
    setError('')
    onSubmit({ email: trimmedEmail, password })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('registerForm.emailLabel')}
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
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

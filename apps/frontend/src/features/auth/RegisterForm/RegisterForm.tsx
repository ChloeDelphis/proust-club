import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterFormProps } from './RegisterForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError } from '../passwordValidation'
import { emailFormatError } from '../emailValidation'
import { passwordMatchesIdentifierError } from '../passwordIdentifierValidation'
import styles from '../AuthForm.module.css'

export default function RegisterForm({ onSubmit }: RegisterFormProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    if (trimmedUsername.length < 3) {
      setError(t('registerForm.usernameTooShortError'))
      return
    }
    const emailError = emailFormatError(trimmedEmail)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = passwordLengthError(password, t('passwordValidation.defaultLabel'))
    if (passwordError) {
      setError(passwordError)
      return
    }
    const identifierError = passwordMatchesIdentifierError(password, trimmedUsername, trimmedEmail)
    if (identifierError) {
      setError(identifierError)
      return
    }
    setError('')
    onSubmit({ username: trimmedUsername, email: trimmedEmail, password })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('loginForm.usernameLabel')}
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
        maxLength={50}
      />
      <FormField
        label={t('registerForm.emailLabel')}
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={255}
      />
      <FormField
        label={t('loginForm.passwordLabel')}
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
      />
      <button className={styles.button} type="submit">
        {t('registerForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

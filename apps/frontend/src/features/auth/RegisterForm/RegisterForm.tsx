import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterFormProps } from './RegisterForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError, passwordLengthHint } from '../passwordValidation'
import { emailFormatError } from '../emailValidation'
import { passwordMatchesIdentifierError } from '../passwordIdentifierValidation'
import { validationConstraints } from '../../../api/generated/validationConstraints.generated'
import styles from '../AuthForm.module.css'

const { username: usernameConstraints, email: emailConstraints, password: passwordConstraints } =
  validationConstraints.RegisterRequest
// Computed once at module scope, not per render: the constraint is a module-level constant, and
// i18n.init() already completes synchronously before any module's top-level code runs (see
// src/i18n/index.ts) — safe to call t() here instead of re-resolving it on every keystroke.
const passwordHint = passwordLengthHint(passwordConstraints)

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

    if (trimmedUsername.length < usernameConstraints.minLength) {
      setError(t('registerForm.usernameTooShortError', { min: usernameConstraints.minLength }))
      return
    }
    const emailError = emailFormatError(trimmedEmail)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = passwordLengthError(password, t('passwordValidation.defaultLabel'), passwordConstraints)
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
        label={t('registerForm.usernameLabel')}
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
        maxLength={usernameConstraints.maxLength}
      />
      <FormField
        label={t('registerForm.emailLabel')}
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={emailConstraints.maxLength}
      />
      <FormField
        label={t('loginForm.passwordLabel')}
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={passwordConstraints.maxLength}
        hint={passwordHint}
      />
      <button className={styles.button} type="submit">
        {t('registerForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

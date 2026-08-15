import { useState } from 'react'
import type { RegisterFormProps } from './RegisterForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError } from '../passwordValidation'
import { emailFormatError } from '../emailValidation'
import { passwordMatchesIdentifierError } from '../passwordIdentifierValidation'
import styles from '../AuthForm.module.css'

export default function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    if (trimmedUsername.length < 3) {
      setError('Le nom d’utilisateur doit contenir au moins 3 caractères.')
      return
    }
    const emailError = emailFormatError(trimmedEmail)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = passwordLengthError(password)
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
        label="Nom d’utilisateur"
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
        maxLength={50}
      />
      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={255}
      />
      <FormField
        label="Mot de passe"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
      />
      <button className={styles.button} type="submit">
        Créer un compte
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

import { useState } from 'react'
import type { LoginFormProps } from './LoginForm.types'
import FormField from '../FormField/FormField'
import styles from '../AuthForm.module.css'

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Renseignez votre nom d’utilisateur et votre mot de passe.')
      return
    }
    setError('')
    onSubmit({ username: username.trim(), password })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label="Nom d’utilisateur"
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
      />
      <FormField
        label="Mot de passe"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <button className={styles.button} type="submit">
        Se connecter
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

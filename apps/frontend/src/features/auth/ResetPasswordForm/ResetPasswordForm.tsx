import { useState } from 'react'
import type { ResetPasswordFormProps } from './ResetPasswordForm.types'
import FormField from '../FormField/FormField'
import styles from '../AuthForm.module.css'

export default function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 15) {
      setError('Le mot de passe doit contenir au moins 15 caractères — une phrase de passe fonctionne très bien.')
      return
    }
    setError('')
    onSubmit({ newPassword })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label="Nouveau mot de passe"
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
      />
      <button className={styles.button} type="submit">
        Réinitialiser le mot de passe
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

import { useState } from 'react'
import type { ChangePasswordFormProps } from './ChangePasswordForm.types'
import FormField from '../FormField/FormField'
import styles from '../AuthForm.module.css'

export default function ChangePasswordForm({ onSubmit }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 15) {
      setError('Le nouveau mot de passe doit contenir au moins 15 caractères — une phrase de passe fonctionne très bien.')
      return
    }
    setError('')
    onSubmit({ currentPassword, newPassword })
    // Cleared unconditionally, success or failure — a password field left filled in after a
    // submit attempt is never useful, and this avoids threading mutation status back into the form.
    setCurrentPassword('')
    setNewPassword('')
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label="Mot de passe actuel"
        type="password"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        maxLength={128}
      />
      <FormField
        label="Nouveau mot de passe"
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
      />
      <button className={styles.button} type="submit">
        Changer le mot de passe
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

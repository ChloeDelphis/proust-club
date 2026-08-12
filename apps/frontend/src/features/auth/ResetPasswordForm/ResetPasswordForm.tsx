import { useState } from 'react'
import type { ResetPasswordFormProps } from './ResetPasswordForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError } from '../passwordValidation'
import styles from '../AuthForm.module.css'

export default function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const passwordError = passwordLengthError(newPassword)
    if (passwordError) {
      setError(passwordError)
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

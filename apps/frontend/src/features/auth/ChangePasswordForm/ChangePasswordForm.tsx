import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChangePasswordFormProps } from './ChangePasswordForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError } from '../passwordValidation'
import styles from '../AuthForm.module.css'

export default function ChangePasswordForm({ onSubmit }: ChangePasswordFormProps) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const passwordError = passwordLengthError(newPassword, t('changePasswordForm.newPasswordSubject'))
    if (passwordError) {
      setError(passwordError)
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
        label={t('changePasswordForm.currentPasswordLabel')}
        type="password"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        maxLength={128}
      />
      <FormField
        label={t('changePasswordForm.newPasswordLabel')}
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
      />
      <button className={styles.button} type="submit">
        {t('changePasswordForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

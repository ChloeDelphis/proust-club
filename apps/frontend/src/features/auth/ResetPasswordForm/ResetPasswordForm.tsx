import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResetPasswordFormProps } from './ResetPasswordForm.types'
import FormField from '../FormField/FormField'
import { passwordLengthError } from '../passwordValidation'
import { validationConstraints } from '../../../api/generated/validationConstraints.generated'
import styles from '../AuthForm.module.css'

const { newPassword: newPasswordConstraints } = validationConstraints.PasswordResetConfirmRequest

export default function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const passwordError = passwordLengthError(newPassword, t('passwordValidation.defaultLabel'), newPasswordConstraints)
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
        label={t('changePasswordForm.newPasswordLabel')}
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        autoComplete="new-password"
        maxLength={newPasswordConstraints.maxLength}
      />
      <button className={styles.button} type="submit">
        {t('resetPasswordForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

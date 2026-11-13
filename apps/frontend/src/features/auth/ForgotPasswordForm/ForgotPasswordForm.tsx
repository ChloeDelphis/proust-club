import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ForgotPasswordFormProps } from './ForgotPasswordForm.types'
import FormField from '../FormField/FormField'
import { emailFormatError } from '../emailValidation'
import { validationConstraints } from '../../../api/generated/validationConstraints.generated'
import styles from '../AuthForm.module.css'

const { email: emailConstraints } = validationConstraints.PasswordResetRequestRequest

export default function ForgotPasswordForm({ onSubmit, isSubmitting = false }: ForgotPasswordFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const emailError = emailFormatError(trimmedEmail)
    if (emailError) {
      setError(emailError)
      return
    }
    setError('')
    onSubmit({ email: trimmedEmail })
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('forgotPasswordForm.emailLabel')}
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={emailConstraints.maxLength}
      />
      <button className={styles.button} type="submit" disabled={isSubmitting}>
        {t(isSubmitting ? 'forgotPasswordForm.submittingButton' : 'forgotPasswordForm.submitButton')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

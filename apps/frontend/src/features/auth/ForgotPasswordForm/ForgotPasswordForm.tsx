import { useState } from 'react'
import type { ForgotPasswordFormProps } from './ForgotPasswordForm.types'
import FormField from '../FormField/FormField'
import { emailFormatError } from '../emailValidation'
import styles from '../AuthForm.module.css'

export default function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
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
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={255}
      />
      <button className={styles.button} type="submit">
        Envoyer le lien de réinitialisation
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

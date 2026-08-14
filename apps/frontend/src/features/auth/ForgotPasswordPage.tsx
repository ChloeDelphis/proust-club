import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { requestPasswordReset } from '../../api/auth'
import type { PasswordResetRequestParams } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import ForgotPasswordForm from './ForgotPasswordForm/ForgotPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function ForgotPasswordPage() {
  const mutation = useMutation({
    mutationFn: (params: PasswordResetRequestParams) => requestPasswordReset(params),
  })

  // ForgotPasswordForm's client-side email check (`includes('@')`) is weaker than the backend's
  // @Email validation, so a malformed address can still reach the server and come back as 400 —
  // not just a rate limit (429) or an unrelated server failure.
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        { 429: 'Trop de tentatives. Réessayez plus tard.', 400: 'Adresse email invalide.' },
        'Une erreur est survenue. Réessayez.',
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Mot de passe oublié</h1>
      {mutation.isSuccess ? (
        <p>
          Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.
          Vérifiez votre boîte de réception.
        </p>
      ) : (
        <>
          <ForgotPasswordForm onSubmit={params => mutation.mutate(params)} />
          {errorMessage && <ErrorMessage message={errorMessage} />}
        </>
      )}
      <p className={styles.switch}>
        <Link to="/login">Retour à la connexion</Link>
      </p>
    </main>
  )
}

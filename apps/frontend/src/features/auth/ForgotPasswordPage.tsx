import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { requestPasswordReset } from '../../api/auth'
import type { PasswordResetRequestParams } from '../../api/auth'
import ForgotPasswordForm from './ForgotPasswordForm/ForgotPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function ForgotPasswordPage() {
  const mutation = useMutation({
    mutationFn: (params: PasswordResetRequestParams) => requestPasswordReset(params),
  })

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
          {mutation.isError && <ErrorMessage message="Adresse email invalide." />}
        </>
      )}
      <p className={styles.switch}>
        <Link to="/login">Retour à la connexion</Link>
      </p>
    </main>
  )
}

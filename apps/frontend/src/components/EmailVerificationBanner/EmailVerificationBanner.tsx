import { useMutation } from '@tanstack/react-query'
import { resendEmailConfirmation } from '../../api/auth'
import { apiErrorMessage } from '../../features/auth/apiErrorMessage'
import { useCurrentUser } from '../../features/auth/useCurrentUser'
import { useToast } from '../Toast/useToast'
import ErrorMessage from '../ErrorMessage/ErrorMessage'
import styles from './EmailVerificationBanner.module.css'

export default function EmailVerificationBanner() {
  const { data: user, isSuccess } = useCurrentUser()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: () => resendEmailConfirmation(),
    onSuccess: () => {
      showToast('Email de confirmation renvoyé.')
    },
  })

  if (!isSuccess || user.emailVerified) {
    return null
  }

  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(mutation.error, { 429: 'Trop de tentatives. Réessayez plus tard.' }, 'Le renvoi a échoué. Réessayez.')

  return (
    <div className={styles.root} role="status">
      <span>Confirmez votre adresse email pour finaliser votre inscription — consultez votre boîte de réception.</span>
      <button
        type="button"
        className={styles.resendButton}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Renvoyer l'email de confirmation
      </button>
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </div>
  )
}

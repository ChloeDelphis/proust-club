import { useMutation } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { changePassword } from '../../api/auth'
import { apiErrorMessage, PASSWORD_COMPROMISED_MESSAGE } from './apiErrorMessage'
import { useCurrentUser } from './useCurrentUser'
import { useToast } from '../../components/Toast/useToast'
import ChangePasswordForm from './ChangePasswordForm/ChangePasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import Spinner from '../../components/Spinner/Spinner'
import styles from './AuthPage.module.css'

export default function AccountPage() {
  const { isPending: isUserPending, isSuccess: isConnected } = useCurrentUser()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) => changePassword(params),
    onSuccess: () => {
      showToast('Mot de passe changé.')
    },
  })

  if (isUserPending) {
    return (
      <main className={styles.root}>
        <Spinner />
      </main>
    )
  }

  if (!isConnected) {
    return <Navigate to="/login" replace />
  }

  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          401: 'Mot de passe actuel incorrect.',
          422: PASSWORD_COMPROMISED_MESSAGE,
        },
        'Le changement de mot de passe a échoué. Réessayez.',
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Compte</h1>
      <ChangePasswordForm onSubmit={params => mutation.mutate(params)} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

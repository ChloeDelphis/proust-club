import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { changePassword } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import { useCurrentUser } from './useCurrentUser'
import { useToast } from '../../components/Toast/useToast'
import ChangePasswordForm from './ChangePasswordForm/ChangePasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import Spinner from '../../components/Spinner/Spinner'
import styles from './AuthPage.module.css'

export default function AccountPage() {
  const { t } = useTranslation()
  const { isPending: isUserPending, isSuccess: isConnected } = useCurrentUser()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) => changePassword(params),
    onSuccess: () => {
      showToast(t('accountPage.passwordChangedToast'))
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
          401: t('accountPage.wrongCurrentPasswordError'),
          422: t('auth.passwordCompromisedError'),
        },
        t('accountPage.genericError'),
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('accountPage.title')}</h1>
      <ChangePasswordForm onSubmit={params => mutation.mutate(params)} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

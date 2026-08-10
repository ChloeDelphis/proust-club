import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { confirmPasswordReset } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import { useToast } from '../../components/Toast/useToast'
import ResetPasswordForm from './ResetPasswordForm/ResetPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './ResetPasswordPage.module.css'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: (newPassword: string) => confirmPasswordReset({ token: token ?? '', newPassword }),
    onSuccess: user => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      showToast('Mot de passe réinitialisé.')
      navigate('/')
    },
  })

  if (!token) {
    return (
      <main className={styles.root}>
        <h1 className={styles.title}>Réinitialiser le mot de passe</h1>
        <ErrorMessage message="Ce lien de réinitialisation est invalide." />
        <p className={styles.switch}>
          <Link to="/forgot-password">Demander un nouveau lien</Link>
        </p>
      </main>
    )
  }

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Réinitialiser le mot de passe</h1>
      <ResetPasswordForm onSubmit={({ newPassword }) => mutation.mutate(newPassword)} />
      {mutation.isError && <ErrorMessage message="Ce lien de réinitialisation est invalide ou a expiré." />}
      <p className={styles.switch}>
        <Link to="/forgot-password">Demander un nouveau lien</Link>
      </p>
    </main>
  )
}

import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { confirmEmail } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import Spinner from '../../components/Spinner/Spinner'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function ConfirmEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const queryClient = useQueryClient()
  const hasFired = useRef(false)

  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: (token: string) => confirmEmail({ token }),
    onSuccess: () => {
      // Confirming doesn't require a session, so there's no user to update by default — but if
      // this browser happens to be logged in as the account being confirmed, refresh emailVerified
      // so the reminder banner disappears without waiting for a reload.
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
    },
  })

  useEffect(() => {
    if (token && !hasFired.current) {
      hasFired.current = true
      mutate(token)
    }
  }, [token, mutate])

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Confirmation de l’email</h1>
      {!token && <ErrorMessage message="Ce lien de confirmation est invalide." />}
      {token && isPending && <Spinner />}
      {token && isSuccess && <p>Votre adresse email a été confirmée.</p>}
      {token && isError && <ErrorMessage message="Ce lien de confirmation est invalide ou a expiré." />}
      {(!token || isSuccess) && (
        <p className={styles.switch}>
          <Link to="/">Retour à l’accueil</Link>
        </p>
      )}
    </main>
  )
}

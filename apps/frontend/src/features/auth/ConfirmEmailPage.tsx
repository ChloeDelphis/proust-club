import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

  // A query, not a mutation: confirming is a one-time side effect, but useQuery's built-in dedup
  // by queryKey is what makes "fire exactly once on mount" safe under React StrictMode's
  // double-invoked effects. A useEffect + useMutation pairing here hit a StrictMode-only race
  // where the request that actually fired wasn't the one the final render ended up subscribed
  // to, leaving the page stuck on the pending state forever — found during manual verification.
  const { isPending, isSuccess, isError } = useQuery({
    queryKey: ['auth', 'confirmEmail', token],
    // TanStack Query treats a queryFn resolving to undefined as an error ("Query data cannot be
    // undefined") — confirmEmail() resolves void (204 No Content), so the result is normalized
    // to a real value here rather than changing confirmEmail()'s return type, which stays
    // Promise<void> for consistency with logout()/changePassword().
    queryFn: async () => {
      await confirmEmail({ token: token! })
      return true
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (isSuccess) {
      // Confirming doesn't require a session, so there's no user to update by default — but if
      // this browser happens to be logged in as the account being confirmed, refresh emailVerified
      // so the reminder banner disappears without waiting for a reload.
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
    }
  }, [isSuccess, queryClient])

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

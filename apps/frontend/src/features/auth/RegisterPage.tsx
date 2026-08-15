import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { register } from '../../api/auth'
import type { RegisterParams } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import { apiErrorMessage } from './apiErrorMessage'
import RegisterForm from './RegisterForm/RegisterForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: RegisterParams) => register(params),
    onSuccess: user => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      navigate('/')
    },
  })

  // 400 only reaches the server if RegisterForm's own client-side check (mirroring the backend
  // rule) was somehow bypassed — kept distinct from the generic message so it stays accurate if
  // that ever happens, rather than pointing the user at the wrong problem.
  const errorMessage = mutation.isError
    && apiErrorMessage(
      mutation.error,
      {
        409: 'Impossible de créer ce compte (nom d’utilisateur ou email déjà utilisé).',
        400: 'Le mot de passe ne peut pas être identique à votre nom d’utilisateur ou à votre email.',
      },
      'Impossible de créer ce compte. Réessayez.',
    )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Créer un compte</h1>
      <RegisterForm onSubmit={params => mutation.mutate(params)} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <p className={styles.switch}>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </main>
  )
}

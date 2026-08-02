import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { login } from '../../api/auth'
import type { LoginParams } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import LoginForm from './LoginForm/LoginForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: LoginParams) => login(params),
    onSuccess: user => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      navigate('/')
    },
  })

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Se connecter</h1>
      <LoginForm onSubmit={params => mutation.mutate(params)} />
      {mutation.isError && <ErrorMessage message="Identifiants invalides." />}
      <p className={styles.switch}>
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </main>
  )
}

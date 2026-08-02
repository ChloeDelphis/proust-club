import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { register } from '../../api/auth'
import type { RegisterParams } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import RegisterForm from './RegisterForm/RegisterForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './RegisterPage.module.css'

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

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Créer un compte</h1>
      <RegisterForm onSubmit={params => mutation.mutate(params)} />
      {mutation.isError && (
        <ErrorMessage message="Impossible de créer ce compte (nom d’utilisateur ou email déjà utilisé)." />
      )}
      <p className={styles.switch}>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </main>
  )
}

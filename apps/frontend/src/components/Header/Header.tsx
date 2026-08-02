import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { logout } from '../../api/auth'
import { useCurrentUser } from '../../features/auth/useCurrentUser'
import styles from './Header.module.css'

export default function Header() {
  const { data: user, isSuccess } = useCurrentUser()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      // Not just the auth/me key: any private per-user data cached elsewhere (future
      // features) must not survive into a second account logging in on the same browser.
      queryClient.clear()
    },
  })

  return (
    <header className={styles.root}>
      <Link className={styles.brand} to="/">Proust Club</Link>
      {isSuccess ? (
        <div className={styles.session}>
          <span>Connecté en tant que {user.username}</span>
          <button className={styles.logoutButton} type="button" onClick={() => logoutMutation.mutate()}>
            Se déconnecter
          </button>
        </div>
      ) : (
        <nav className={styles.nav}>
          <Link to="/login">Se connecter</Link>
          <Link to="/register">Créer un compte</Link>
        </nav>
      )}
    </header>
  )
}

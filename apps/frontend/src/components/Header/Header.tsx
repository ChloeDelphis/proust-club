import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { logout } from '../../api/auth'
import { useCurrentUser } from '../../features/auth/useCurrentUser'
import styles from './Header.module.css'

export default function Header() {
  const { t } = useTranslation()
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
      <Link className={styles.brand} to="/">{t('header.brand')}</Link>
      {isSuccess ? (
        <div className={styles.session}>
          <Link to="/mes-citations">{t('header.myQuotesLink')}</Link>
          <Link to="/account">{t('header.accountLink')}</Link>
          <span>{t('header.loggedInAs', { username: user.username })}</span>
          <button className={styles.logoutButton} type="button" onClick={() => logoutMutation.mutate()}>
            {t('header.logout')}
          </button>
        </div>
      ) : (
        <nav className={styles.nav}>
          <Link to="/login">{t('header.login')}</Link>
          <Link to="/register">{t('header.register')}</Link>
        </nav>
      )}
    </header>
  )
}

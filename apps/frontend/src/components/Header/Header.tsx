import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Menu } from '@base-ui/react/menu'
import { logout } from '../../api/auth'
import { useCurrentUser } from '../../features/auth/useCurrentUser'
import styles from './Header.module.css'

export default function Header() {
  const { t } = useTranslation()
  const { data: user, isSuccess, isError } = useCurrentUser()
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
      {isSuccess && user && (
        <div className={styles.session}>
          <Menu.Root>
            <Menu.Trigger className={styles.avatar} aria-label={t('header.loggedInAs', { username: user.username })}>
              {user.username.charAt(0).toUpperCase()}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={8}>
                <Menu.Popup className={styles.accountMenu}>
                  <Menu.Item className={styles.menuItem} render={<Link to="/account" />}>
                    {t('header.accountLink')}
                  </Menu.Item>
                  <Menu.Item className={styles.menuItem} onClick={() => logoutMutation.mutate()}>
                    {t('header.logout')}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}
      {isSuccess && user === null && (
        <nav className={styles.nav}>
          <Link to="/login">{t('header.login')}</Link>
          <Link to="/register">{t('header.register')}</Link>
        </nav>
      )}
      {isError && <span role="status">{t('common.genericError')}</span>}
    </header>
  )
}

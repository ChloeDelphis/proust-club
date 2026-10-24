import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Menu } from '@base-ui/react/menu'
import { Dialog } from '@base-ui/react/dialog'
import { logout } from '../../api/auth'
import { useCurrentUser } from '../../features/auth/useCurrentUser'
import VolumeList from '../../features/quotes/VolumeList/VolumeList'
import { useVolumeSelection } from '../../features/search/useVolumeSelection'
import styles from './Header.module.css'

export default function Header() {
  const { t } = useTranslation()
  const { data: user, isSuccess } = useCurrentUser()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { selectedVolumeId, selectVolume } = useVolumeSelection()
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const touchOrigin = useRef<{ x: number; y: number } | null>(null)
  const isSearchPage = location.pathname === '/'

  function handleDrawerTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    touchOrigin.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleDrawerTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const origin = touchOrigin.current
    const touch = event.changedTouches[0]
    touchOrigin.current = null
    if (!origin || !touch) return

    const deltaX = touch.clientX - origin.x
    const deltaY = touch.clientY - origin.y
    if (deltaX < -48 && Math.abs(deltaX) > Math.abs(deltaY)) setIsNavigationOpen(false)
  }

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
      {isSearchPage && (
        <Dialog.Root open={isNavigationOpen} onOpenChange={setIsNavigationOpen}>
          <Dialog.Trigger className={styles.tomeMenuTrigger} aria-label={t('header.openNavigation')}>
            <span className={styles.menuIcon} aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className={styles.drawerBackdrop} />
            <Dialog.Popup
              className={styles.navigationDrawer}
              aria-label={t('header.navigationLabel')}
              onTouchStart={handleDrawerTouchStart}
              onTouchEnd={handleDrawerTouchEnd}
              onTouchCancel={() => { touchOrigin.current = null }}
            >
              <div className={styles.drawerHeading}>
                <Dialog.Title className={styles.drawerTitle}>{t('header.navigationTitle')}</Dialog.Title>
                <Dialog.Close className={styles.drawerClose} aria-label={t('tagPicker.close')}>×</Dialog.Close>
              </div>
              <div className={styles.drawerVolumes}>
                <VolumeList
                  selectedVolumeId={selectedVolumeId}
                  onSelectVolume={id => {
                    selectVolume(id)
                    setIsNavigationOpen(false)
                  }}
                />
              </div>
              {isSuccess && user === null && (
                <nav className={styles.drawerActions} aria-label={t('header.accountMenuLabel')}>
                  <Link className={styles.drawerActionPrimary} to="/login" onClick={() => setIsNavigationOpen(false)}>
                    {t('header.login')}
                  </Link>
                  <Link className={styles.drawerActionSecondary} to="/register" onClick={() => setIsNavigationOpen(false)}>
                    {t('header.register')}
                  </Link>
                </nav>
              )}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      <Link className={styles.brand} to="/">{t('header.brand')}</Link>
      {isSuccess && user && (
        <div className={styles.session}>
          <Menu.Root>
            <Menu.Trigger className={styles.avatar} aria-label={t('header.loggedInAs', { username: user.username })}>
              {user.username.charAt(0).toUpperCase()}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className={styles.accountMenuPositioner} align="end" sideOffset={8}>
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
        <div className={styles.actions}>
          <Menu.Root>
            <Menu.Trigger className={styles.accountTrigger} aria-label={t('header.accountMenuLabel')}>
              <span className={styles.accountIcon} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className={styles.accountMenuPositioner} align="end" sideOffset={8}>
                <Menu.Popup className={styles.accountMenu}>
                  <Menu.Item className={styles.menuItem} render={<Link to="/login" />}>
                    {t('header.login')}
                  </Menu.Item>
                  <Menu.Item className={styles.menuItem} render={<Link to="/register" />}>
                    {t('header.register')}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}
    </header>
  )
}

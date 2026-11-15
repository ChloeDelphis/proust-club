import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { useCurrentUser } from './useCurrentUser'
import AccountPageContent from './AccountPageContent'
import Spinner from '../../components/Spinner/Spinner'
import styles from './AccountPage.module.css'

export default function AccountPage() {
  const { t } = useTranslation()
  const { data: currentUser, isPending: isUserPending, isError: isUserError } = useCurrentUser()

  if (isUserPending) {
    return (
      <main className={styles.root}>
        <Spinner />
      </main>
    )
  }

  if (isUserError) {
    return (
      <main className={styles.root}>
        <h1 className={styles.title}>{t('accountPage.title')}</h1>
      </main>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return <AccountPageContent currentUser={currentUser} />
}

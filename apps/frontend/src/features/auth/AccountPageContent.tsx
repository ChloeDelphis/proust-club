import { useTranslation } from 'react-i18next'
import type { UserResponse } from '../../api/auth'
import AccountDeletionSection from './AccountDeletionSection'
import AccountPasswordSection from './AccountPasswordSection'
import styles from './AccountPage.module.css'

export default function AccountPageContent({ currentUser }: { currentUser: UserResponse }) {
  const { t } = useTranslation()

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('accountPage.title')}</h1>
      <section className={styles.section} aria-labelledby="account-personal-information">
        <h2 className={styles.sectionTitle} id="account-personal-information">
          {t('accountPage.personalInformationTitle')}
        </h2>
        <dl className={styles.informationList}>
          <div className={styles.informationItem}>
            <dt className={styles.informationLabel}>{t('accountPage.emailLabel')}</dt>
            <dd className={styles.email}>{currentUser.email}</dd>
          </div>
        </dl>
      </section>
      <AccountPasswordSection username={currentUser.username} email={currentUser.email} />
      <AccountDeletionSection />
    </main>
  )
}

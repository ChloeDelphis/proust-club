import { useTranslation } from 'react-i18next'
import type { UserResponse } from '../../api/auth'
import AccountDeletionSection from './AccountDeletionSection'
import AccountPasswordSection from './AccountPasswordSection'
import EmailVerificationStatus from './EmailVerificationStatus'
import { useEmailVerificationResendCooldown } from './useResendEmailConfirmation'
import { formatEmailVerificationCooldown } from './emailVerificationCooldown'
import styles from './AccountPage.module.css'

export default function AccountPageContent({ currentUser }: { currentUser: UserResponse }) {
  const { t } = useTranslation()
  const cooldown = useEmailVerificationResendCooldown(
    currentUser.emailVerified ? undefined : currentUser.uuid,
  )
  const cooldownMessage = cooldown
    ? formatEmailVerificationCooldown(cooldown.displaySeconds)
    : null

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('accountPage.title')}</h1>
      <section className={styles.section} aria-labelledby="account-personal-information">
        <h2 className={styles.sectionTitle} id="account-personal-information">
          {t('accountPage.personalInformationTitle')}
        </h2>
        <dl className={styles.informationList}>
          <div className={styles.informationItem}>
            <dt className={`${styles.itemTitle} ${styles.informationLabel}`}>
              {t('accountPage.emailLabel')}
            </dt>
            <dd className={`${styles.email} ${!currentUser.emailVerified ? styles.emailUnverified : ''}`}>
              {currentUser.email}
            </dd>
            {!currentUser.emailVerified && <EmailVerificationStatus cooldown={cooldown} />}
          </div>
        </dl>
        {!currentUser.emailVerified && (
          <>
            {cooldownMessage && (
              <p className={styles.emailVerificationCooldown} role="status">
                {cooldownMessage}
              </p>
            )}
            <p className={`${styles.itemDescription} ${styles.emailVerificationDescription}`}>
              {t('accountPage.emailConfirmationBenefit')}
            </p>
          </>
        )}
      </section>
      <AccountPasswordSection username={currentUser.username} email={currentUser.email} />
      <AccountDeletionSection />
    </main>
  )
}

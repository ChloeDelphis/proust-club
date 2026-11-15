import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { changePassword } from '../../api/auth'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import { useToast } from '../../components/Toast/useToast'
import ChangePasswordForm from './ChangePasswordForm/ChangePasswordForm'
import { apiErrorMessage } from './apiErrorMessage'
import styles from './AccountPage.module.css'

interface AccountPasswordSectionProps {
  username: string | null
  email: string
}

export default function AccountPasswordSection({ username, email }: AccountPasswordSectionProps) {
  const { t } = useTranslation()
  const showToast = useToast()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) => changePassword(params),
    onSuccess: () => {
      setIsFormOpen(false)
      showToast(t('accountPage.passwordChangedToast'))
    },
  })
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          401: t('accountPage.wrongCurrentPasswordError'),
          422: t('auth.passwordCompromisedError'),
        },
        t('accountPage.genericError'),
        { password_matches_identifier: t('passwordIdentifierValidation.matchesIdentifierError') },
      )

  return (
    <section className={styles.section} aria-labelledby="account-security">
      <h2 className={styles.sectionTitle} id="account-security">{t('accountPage.securityTitle')}</h2>
      <div className={styles.passwordRow}>
        <div className={styles.passwordCopy}>
          <h3 className={styles.itemTitle}>{t('accountPage.passwordTitle')}</h3>
        </div>
        {!isFormOpen && (
          <button
            className={styles.secondaryButton}
            type="button"
            aria-controls="account-password-form"
            onClick={() => setIsFormOpen(true)}
          >
            {t('accountPage.editPasswordButton')}
          </button>
        )}
      </div>
      {isFormOpen && (
        <div className={styles.passwordForm} id="account-password-form">
          <ChangePasswordForm
            username={username}
            email={email}
            isSubmitting={mutation.isPending}
            onCancel={() => {
              mutation.reset()
              setIsFormOpen(false)
            }}
            onSubmit={params => mutation.mutate(params)}
          />
          {errorMessage && <ErrorMessage message={errorMessage} />}
        </div>
      )}
    </section>
  )
}

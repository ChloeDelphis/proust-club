import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { deleteAccount } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import DeleteAccountDialog from './DeleteAccountDialog/DeleteAccountDialog'
import styles from './AccountPage.module.css'

export default function AccountDeletionSection() {
  const { t } = useTranslation()
  const showToast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: (params: { currentPassword: string }) => deleteAccount(params),
    onSuccess: () => {
      showToast(t('accountPage.accountDeletedToast'))
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })
  const apiError = mutation.error
  const passwordApiError = mutation.isError && apiError instanceof ApiError && apiError.status === 401
    ? apiError
    : null
  const rateLimitApiError = mutation.isError && apiError instanceof ApiError && apiError.status === 429
    ? apiError
    : null
  const retryAfterSeconds = rateLimitApiError?.retryAfterSeconds
  const passwordError = passwordApiError ? t('deleteAccountDialog.wrongCurrentPasswordError') : null
  const globalError = !mutation.isError || passwordApiError
    ? null
    : rateLimitApiError
      ? {
          message: t('deleteAccountDialog.rateLimitMessage'),
          detail: retryAfterSeconds === undefined
            ? t('deleteAccountDialog.retryAfterFallback')
            : Math.ceil(retryAfterSeconds / 60) === 1
              ? t('deleteAccountDialog.retryAfterOneMinute')
              : t('deleteAccountDialog.retryAfterMinutes', { minutes: Math.ceil(retryAfterSeconds / 60) }),
        }
      : {
          title: apiError instanceof ApiError
            ? t('deleteAccountDialog.technicalErrorTitleWithStatus', { status: apiError.status })
            : t('deleteAccountDialog.technicalErrorTitle'),
          message: t('deleteAccountDialog.genericError'),
        }

  return (
    <>
      <section className={`${styles.section} ${styles.deleteSection}`} aria-labelledby="account-delete">
        <h2 className={styles.sectionTitle} id="account-delete">{t('accountPage.deleteTitle')}</h2>
        <p className={styles.itemDescription}>{t('accountPage.deleteDescription')}</p>
        <button
          className={styles.deleteButton}
          type="button"
          onClick={() => {
            mutation.reset()
            setIsDialogOpen(true)
          }}
        >
          {t('accountPage.deleteAccountButton')}
        </button>
      </section>
      <DeleteAccountDialog
        open={isDialogOpen}
        isDeleting={mutation.isPending}
        passwordError={passwordError}
        globalError={globalError}
        onCancel={() => {
          mutation.reset()
          setIsDialogOpen(false)
        }}
        onConfirm={currentPassword => mutation.mutate({ currentPassword })}
      />
    </>
  )
}

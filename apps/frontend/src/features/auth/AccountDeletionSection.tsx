import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { deleteAccount } from '../../api/auth'
import { useToast } from '../../components/Toast/useToast'
import { apiErrorMessage } from './apiErrorMessage'
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
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          401: t('deleteAccountDialog.wrongCurrentPasswordError'),
          429: t('deleteAccountDialog.rateLimitError'),
        },
        t('deleteAccountDialog.genericError'),
      )

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
        errorMessage={errorMessage}
        onCancel={() => {
          mutation.reset()
          setIsDialogOpen(false)
        }}
        onConfirm={currentPassword => mutation.mutate({ currentPassword })}
      />
    </>
  )
}

import { useId, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useTranslation } from 'react-i18next'
import FormField from '../FormField/FormField'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import styles from './DeleteAccountDialog.module.css'

interface DeleteAccountDialogProps {
  open: boolean
  isDeleting: boolean
  passwordError: string | null
  globalError: { title?: string; message: string; detail?: string } | null
  onCancel: () => void
  onConfirm: (currentPassword: string) => void
}

export default function DeleteAccountDialog({
  open,
  isDeleting,
  passwordError,
  globalError,
  onCancel,
  onConfirm,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const [currentPassword, setCurrentPassword] = useState('')

  function cancel() {
    setCurrentPassword('')
    onCancel()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm(currentPassword)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => { if (!nextOpen && !isDeleting) cancel() }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-labelledby={titleId} aria-describedby={descriptionId}>
          <Dialog.Close
            className={styles.closeButton}
            aria-label={t('tagPicker.close')}
            disabled={isDeleting}
          >
            ×
          </Dialog.Close>
          <Dialog.Title className={styles.title} id={titleId}>
            {t('deleteAccountDialog.title')}
          </Dialog.Title>
          <div className={styles.copy} id={descriptionId}>
            <p className={styles.description}>
              {t('deleteAccountDialog.description')}
            </p>
            <p className={styles.instruction}>
              {t('deleteAccountDialog.confirmationInstruction')}
            </p>
          </div>
          <form className={styles.form} onSubmit={submit}>
            <FormField
              label={t('deleteAccountDialog.currentPasswordLabel')}
              isUiField
              error={passwordError ?? undefined}
              feedback={globalError ? (
                <ErrorMessage
                  title={globalError.title}
                  message={globalError.message}
                  detail={globalError.detail}
                  plain
                />
              ) : undefined}
              reserveErrorSpace
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <div className={styles.actions}>
              <button className={styles.cancelButton} type="button" onClick={cancel} disabled={isDeleting}>
                {t('deleteAccountDialog.cancelButton')}
              </button>
              <button
                className={styles.deleteButton}
                type="submit"
                disabled={isDeleting || currentPassword.trim().length === 0}
                aria-busy={isDeleting}
              >
                {isDeleting && <span className={styles.spinner} aria-hidden="true" />}
                <span>{t(isDeleting ? 'deleteAccountDialog.pendingButton' : 'deleteAccountDialog.confirmButton')}</span>
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
